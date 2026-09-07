import { NextResponse } from "next/server";
import { readState, saveState, incrementPageViews } from "@/server/store";
import {
  authConfigured,
  createSession,
  equalSecret,
  isOrganizer,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS,
  ADMIN_EMAIL,
} from "@/server/auth";
import { playerSchema, updateSchema } from "@/server/validation";
import { inspectPlayer, sheetRows, fetchTeamsFromResponseSheet, getSpreadsheetTabs } from "@/server/sheets";
import {
  ensureSyncSchedulerRunning,
  checkAndTriggerHourlySync,
  syncSpreadsheetBackground,
} from "@/server/sync";
import { z } from "zod";
import { canRegister, listedPlayers, registrationUrl } from "@/lib/tournaments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Background sync is available via Organizer 'Sync Now' button or Vercel Cron (/api/cron/sync)
// Do not start continuous 24/7 intervals to protect Neon DB free tier compute hours

type Context = { params: Promise<{ path: string[] }> };
const attempts = new Map<string, { count: number; reset: number }>();
const recentViewIps = new Map<string, number>();
const PV_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown window
const PV_COOKIE = "ch_pv_session";

function normalizeIp(ip: string): string {
  if (!ip) return "";
  let clean = ip.trim();
  if (clean.startsWith("::ffff:")) clean = clean.slice(7);
  if (clean === "::1" || clean === "localhost") return "127.0.0.1";
  return clean;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return normalizeIp(cfConnectingIp);
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeIp(realIp);
  const nextIp = (request as any).ip;
  if (nextIp) return normalizeIp(String(nextIp));
  return "127.0.0.1";
}

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, context: Context) {
  const route = (await context.params).path.join("/");
  try {
    if (route === "health") return json({ status: "ok", framework: "Next.js" });
    if (route === "page-view") {
      const state = await readState();
      return json({ pageViews: state.pageViews || 0 });
    }
    if (route === "auth")
      return json({
        authenticated: await isOrganizer(),
        configured: authConfigured(),
        adminEmail: ADMIN_EMAIL,
      });
    if (route === "app-state") {
      return json(await readState());
    }
    if (route === "raffle/live-spin") {
      const { getLiveSpinState } = await import("@/server/liveSpinStore");
      return json({ liveSpin: getLiveSpinState() });
    }
    if (route === "raffle/live-stream") {
      const { getLiveSpinState, subscribeLiveSpin } = await import("@/server/liveSpinStore");
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const initialData = `data: ${JSON.stringify(getLiveSpinState())}\n\n`;
          controller.enqueue(encoder.encode(initialData));

          const unsubscribe = subscribeLiveSpin((state) => {
            try {
              const data = `data: ${JSON.stringify(state)}\n\n`;
              controller.enqueue(encoder.encode(data));
            } catch {
              // stream closed
            }
          });

          const pingInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
            } catch {
              clearInterval(pingInterval);
            }
          }, 15000);

          request.signal.addEventListener("abort", () => {
            clearInterval(pingInterval);
            unsubscribe();
            try {
              controller.close();
            } catch {}
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
    if (route === "raffle") {
      const { getRaffleState, getArchivedRaffles } = await import("@/server/raffleStore");
      const url = new URL(request.url);
      const requestedId = url.searchParams.get("id") || "default";
      const raffle = await getRaffleState(requestedId);
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/ch_raffle_device=([^;]+)/);
      const urlParamDev = url.searchParams.get("deviceId");
      const deviceId = match ? decodeURIComponent(match[1]) : urlParamDev || undefined;
      const clientIp = getClientIp(request);
      const myEntry = raffle.entries.find(
        (e) =>
          (deviceId && e.deviceId === deviceId) ||
          (clientIp && e.ipAddress && e.ipAddress === clientIp),
      );

      const now = Date.now();
      const cutoffMs = raffle.cutoffDate ? new Date(raffle.cutoffDate).getTime() : Infinity;
      const isEnded = !raffle.isActive || now > cutoffMs;
      const archives = await getArchivedRaffles();
      const appState = await readState();

      const response = json({
        id: raffle.id,
        title: raffle.title,
        category: raffle.category || "Diamonds Giveaway",
        description: raffle.description,
        cutoffDate: raffle.cutoffDate,
        prizes: raffle.prizes,
        isActive: raffle.isActive,
        isArchived: Boolean(raffle.isArchived),
        isEnded,
        entriesCount: raffle.entries.length,
        winners: raffle.entries
          .filter((e) => Boolean(e.prizeWon))
          .map((e) => ({ id: e.id, fullName: e.fullName, prizeWon: e.prizeWon })),
        entries: raffle.entries.map((e) => ({
          id: e.id,
          raffleId: e.raffleId || raffle.id,
          raffleTitle: e.raffleTitle || raffle.title,
          category: e.category || raffle.category || "Diamonds Giveaway",
          fullName: e.fullName,
          prizeWon: e.prizeWon || null,
          createdAt: e.createdAt,
        })),
        myEntry: myEntry
          ? {
              id: myEntry.id,
              fullName: myEntry.fullName,
              prizeWon: myEntry.prizeWon || null,
              createdAt: myEntry.createdAt,
              deviceId: myEntry.deviceId,
            }
          : null,
        archives,
        branding: {
          bannerUrl:
            appState.bannerUrl ||
            appState.bannerSettings?.customUrl ||
            "/images/mlbb-ch-banner.png",
          logoUrl:
            appState.logoUrl ||
            appState.bannerSettings?.avatarCustomUrl ||
            "/images/mlbb-ch-avatar.png",
          title: appState.bannerSettings?.title || "MLBB PH - Community Heroes",
          facebookPageUrl:
            appState.bannerSettings?.facebookPageUrl ||
            "https://www.facebook.com/MLBBPHCommunityHeroes",
        },
      });

      if (myEntry?.deviceId && !match) {
        response.cookies.set("ch_raffle_device", myEntry.deviceId, {
          path: "/",
          maxAge: 365 * 24 * 60 * 60,
          sameSite: "lax",
        });
      }

      return response;
    }
    if (route === "cron/sync" || route === "sync") {
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return json({ error: "Unauthorized cron execution." }, 401);
      }
      return json(await syncSpreadsheetBackground());
    }
    if (route === "register") {
      const id = new URL(request.url).searchParams.get("id");
      const state = await readState();
      const player = listedPlayers(state).find(
        (player) => player.id === id,
      );
      if (!player)
        return json({ error: "This Community Hero is no longer listed." }, 404);
      if (!canRegister(player, state.activeTabName))
        return json(
          {
            error: `${player.chNickname} is not accepting registrations. This month's tournament cycle has ended or the slots are full.`,
          },
          409,
        );
      return json({ url: registrationUrl(player) });
    }
    if (route === "app-state/sync") {
      void checkAndTriggerHourlySync();
      const state = await readState();
      return json({
        lastUpdated: state.lastUpdated || 0,
        lastHourlySync: state.lastHourlySync || 0,
        count: state.players.length,
      });
    }
    if (route === "sync-now") {
      return json(await syncSpreadsheetBackground());
    }
    if (route === "sheets/tabs") {
      if (!(await isOrganizer()))
        return json({ error: "Sign in to the organizer workspace." }, 401);
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get("url") || "";
      const authHeader = request.headers.get("authorization") || undefined;
      const result = await getSpreadsheetTabs(targetUrl, authHeader);
      return json(result);
    }
    if (route === "sheets/data") {
      if (!(await isOrganizer()))
        return json({ error: "Sign in to the organizer workspace." }, 401);
      const url = new URL(request.url);
      return json({
        rows: await sheetRows(
          url.searchParams.get("url") || "",
          url.searchParams.get("sheet") || undefined,
          request.headers.get("authorization") || undefined,
        ),
      });
    }
    if (route === "tournament-teams") {
      const { searchParams } = new URL(request.url);
      const playerId = searchParams.get("playerId");
      const state = await readState();
      const player = state.players.find((p) => p.id === playerId);
      if (!player) {
        return json({ error: "Community Hero not found." }, 404);
      }
      if (player.registeredTeams && player.registeredTeams.length > 0) {
        return json({ teams: player.registeredTeams, count: player.registeredTeams.length, source: "cached" });
      }
      if (player.tournamentResponseSheet) {
        try {
          const { getValidGoogleAccessToken } = await import("@/server/googleToken");
          const serverToken = (await getValidGoogleAccessToken()) || state.googleAccessToken;
          const token = request.headers.get("authorization") || serverToken;
          const liveTeams = await fetchTeamsFromResponseSheet(
            player.tournamentResponseSheet,
            token,
          );
          if (liveTeams.length > 0) {
            player.registeredTeams = liveTeams;
            player.teamsRegistered = liveTeams.length;
            await saveState({ players: state.players });
            return json({ teams: liveTeams, count: liveTeams.length, source: "sheet" });
          }
        } catch {
          // Response sheet could not be read
        }
      }
      return json({ teams: [], count: 0, source: "none" });
    }
    return json({ error: "Endpoint not found." }, 404);
  } catch (error) {
    console.error(error);
    return json(
      {
        error:
          route === "sheets/data" || route === "sheets/tabs"
            ? (error as Error).message
            : "Could not load the directory. Please try again.",
      },
      500,
    );
  }
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request))
    return json({ error: "Request origin is not allowed." }, 403);
  const route = (await context.params).path.join("/");
  try {
    if (route === "page-view") {
      const cookieHeader = request.headers.get("cookie") || "";
      const hasCookie = cookieHeader.includes(`${PV_COOKIE}=`);

      const ip =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        request.headers.get("x-client-ip") ||
        "unknown";
      const ua = request.headers.get("user-agent") || "";
      const identifier =
        ip !== "unknown"
          ? ip
          : `ua_${Buffer.from(ua).toString("base64").slice(0, 32)}`;

      const now = Date.now();
      const lastTime = recentViewIps.get(identifier) || 0;
      const isCooledDown = now - lastTime < PV_COOLDOWN_MS;

      const state = await readState();
      const currentViews = state.pageViews || 0;

      // If already visited within 30-min window, do not increment
      if (hasCookie || isCooledDown) {
        return json({ pageViews: currentViews, counted: false });
      }

      recentViewIps.set(identifier, now);
      if (recentViewIps.size > 10000) {
        for (const [id, time] of recentViewIps.entries()) {
          if (now - time > PV_COOLDOWN_MS) recentViewIps.delete(id);
        }
      }

      const newViews = await incrementPageViews();
      const response = json({ pageViews: newViews, counted: true });
      response.cookies.set(PV_COOKIE, "1", {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 1800, // 30 minutes
      });
      return response;
    }
    if (route === "auth/logout") {
      const response = json({ success: true });
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    if (route === "auth/google") {
      const body = (await request.json()) as any;
      if (body.code) {
        const { exchangeGoogleAuthCode } = await import("@/server/googleToken");
        const exchanged = await exchangeGoogleAuthCode(body.code);
        if (exchanged.email && exchanged.email.toLowerCase().trim() !== ADMIN_EMAIL) {
          return json(
            {
              error: `Access denied. Only ${ADMIN_EMAIL} is authorized to access the organizer workspace.`,
            },
            403,
          );
        }
        const response = json({ success: true, email: ADMIN_EMAIL, accessToken: exchanged.accessToken });
        response.cookies.set(SESSION_COOKIE, createSession(), {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_SECONDS,
        });
        return response;
      }

      const { email, accessToken } = z
        .object({
          email: z.string().email(),
          accessToken: z.string().optional(),
        })
        .parse(body);
      if (email.toLowerCase().trim() !== ADMIN_EMAIL) {
        return json(
          {
            error: `Access denied. Only ${ADMIN_EMAIL} is authorized to access the organizer workspace.`,
          },
          403,
        );
      }
      if (accessToken) {
        try {
          await saveState({
            googleAccessToken: accessToken,
            googleConnectedEmail: email,
            googleTokenExpiresAt: Date.now() + 3600 * 1000,
          });
        } catch {
          // non-fatal
        }
      }
      const response = json({ success: true, email: ADMIN_EMAIL });
      response.cookies.set(SESSION_COOKIE, createSession(), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return response;
    }
    if (route === "auth/login") {
      const body = (await request.json()) as { email?: string; password?: string };
      if (body.email) {
        const email = String(body.email).toLowerCase().trim();
        if (email !== ADMIN_EMAIL) {
          return json(
            {
              error: `Access denied. Only ${ADMIN_EMAIL} is authorized to access the organizer workspace.`,
            },
            403,
          );
        }
        const response = json({ success: true, email: ADMIN_EMAIL });
        response.cookies.set(SESSION_COOKIE, createSession(), {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_SECONDS,
        });
        return response;
      }
      if (process.env.ADMIN_PASSWORD && body.password) {
        const key = "organizer";
        const now = Date.now();
        const attempt = attempts.get(key);
        if (attempt && attempt.reset > now && attempt.count >= 10)
          return json(
            { error: "Too many attempts. Try again in 15 minutes." },
            429,
          );
        if (!equalSecret(String(body.password), process.env.ADMIN_PASSWORD)) {
          attempts.set(key, {
            count: attempt && attempt.reset > now ? attempt.count + 1 : 1,
            reset: attempt && attempt.reset > now ? attempt.reset : now + 900_000,
          });
          return json(
            { error: "That password doesn’t match. Please try again." },
            401,
          );
        }
        attempts.delete(key);
        const response = json({ success: true, email: ADMIN_EMAIL });
        response.cookies.set(SESSION_COOKIE, createSession(), {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_SECONDS,
        });
        return response;
      }
      return json({ error: "Please sign in with Google." }, 400);
    }
    if (route === "cron/sync" || route === "sync") {
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return json({ error: "Unauthorized cron execution." }, 401);
      }
      return json(await syncSpreadsheetBackground());
    }
    if (route === "raffle/live-spin") {
      if (!(await isOrganizer())) {
        return json({ error: "Unauthorized" }, 401);
      }
      const { broadcastLiveSpin, getLiveSpinState } = await import("@/server/liveSpinStore");
      const body = (await request.json()) as any;
      if (body.action === "start") {
        const spinState = {
          id: `spin-${Date.now()}`,
          raffleId: body.raffleId || "default",
          prize: String(body.prize || "Grand Prize"),
          winnerId: String(body.winnerId),
          winnerName: String(body.winnerName),
          winningIndex: Number(body.winningIndex) || 0,
          startedAt: Number(body.startedAt) || Date.now(),
          durationMs: Number(body.durationMs) || 5200,
          sliceCount: Number(body.sliceCount) || 1,
          status: "spinning" as const,
        };
        broadcastLiveSpin(spinState);
        return json({ success: true, liveSpin: spinState });
      }
      if (body.action === "landed") {
        const current = getLiveSpinState();
        if (current) {
          const claimSeconds = Number(body.claimSeconds) || 60;
          const claimDeadline = Number(body.claimDeadline) || (Date.now() + claimSeconds * 1000);
          const landedState = {
            ...current,
            status: "landed" as const,
            claimSeconds,
            claimDeadline,
            isAwarded: false,
          };
          broadcastLiveSpin(landedState);
          return json({ success: true, liveSpin: landedState });
        }
        return json({ success: true, liveSpin: null });
      }
      if (body.action === "claim_timer") {
        const current = getLiveSpinState();
        if (current) {
          const claimSeconds = Number(body.claimSeconds) || 60;
          const claimDeadline = Number(body.claimDeadline) || (Date.now() + claimSeconds * 1000);
          const timerState = {
            ...current,
            claimSeconds,
            claimDeadline,
          };
          broadcastLiveSpin(timerState);
          return json({ success: true, liveSpin: timerState });
        }
        return json({ success: true, liveSpin: null });
      }
      if (body.action === "awarded") {
        const current = getLiveSpinState();
        if (current) {
          const awardedState = {
            ...current,
            isAwarded: true,
          };
          broadcastLiveSpin(awardedState);
          return json({ success: true, liveSpin: awardedState });
        }
        return json({ success: true, liveSpin: null });
      }
      if (body.action === "repick" || body.action === "clear" || body.action === "end") {
        broadcastLiveSpin(null);
        return json({ success: true, liveSpin: null });
      }
      return json({ liveSpin: getLiveSpinState() });
    }
    if (route === "raffle/join") {
      const body = (await request.json()) as { fullName?: string; deviceId?: string; raffleId?: string };
      const fullName = (body.fullName || "").trim();
      if (!fullName) {
        return json({ error: "Please enter your full name." }, 400);
      }

      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/ch_raffle_device=([^;]+)/);
      const deviceId = match
        ? decodeURIComponent(match[1])
        : body.deviceId || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const clientIp = getClientIp(request);

      const { submitRaffleEntry } = await import("@/server/raffleStore");
      const res = await submitRaffleEntry(body.raffleId || "default", fullName, deviceId, clientIp);

      if (!res.success) {
        return json({ error: res.error || "Could not join raffle." }, 400);
      }

      const activeDeviceId = res.entry?.deviceId || deviceId;

      const response = json({
        success: true,
        updated: res.updated,
        deviceId: activeDeviceId,
        entry: res.entry
          ? {
              id: res.entry.id,
              raffleId: res.entry.raffleId,
              raffleTitle: res.entry.raffleTitle,
              category: res.entry.category,
              fullName: res.entry.fullName,
              prizeWon: res.entry.prizeWon || null,
            }
          : null,
      });

      response.cookies.set("ch_raffle_device", activeDeviceId, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
      });

      return response;
    }

    if (!(await isOrganizer()))
      return json(
        { error: "Your session has ended. Sign in to save changes." },
        401,
      );
    if (route === "app-state") {
      const update = updateSchema.parse(await request.json());
      return json(await saveState(update));
    }
    if (route === "sheets/connect-google") {
      const body = (await request.json()) as any;
      if (body.code) {
        const { exchangeGoogleAuthCode } = await import("@/server/googleToken");
        const exchanged = await exchangeGoogleAuthCode(body.code);
        return json({
          success: true,
          email: exchanged.email || ADMIN_EMAIL,
          accessToken: exchanged.accessToken,
          permanent: true,
        });
      }
      if (body.accessToken) {
        await saveState({
          googleAccessToken: body.accessToken,
          googleConnectedEmail: body.email || ADMIN_EMAIL,
          googleTokenExpiresAt: Date.now() + 3600 * 1000,
        });
        return json({
          success: true,
          email: body.email || ADMIN_EMAIL,
          permanent: false,
        });
      }
      return json({ error: "No code or access token provided." }, 400);
    }
    if (route === "detect-tournament-status") {
      const body = z
        .object({ players: z.array(playerSchema).max(100) })
        .parse(await request.json());
      const players = [];
      for (let i = 0; i < body.players.length; i += 5)
        players.push(
          ...(await Promise.all(
            body.players
              .slice(i, i + 5)
              .map((player) =>
                inspectPlayer(
                  player,
                  request.headers.get("authorization") || undefined,
                ),
              ),
          )),
        );
      return json({ players, timestamp: new Date().toISOString() });
    }
    if (route === "sync-now") {
      return json(await syncSpreadsheetBackground());
    }
    if (route === "raffle/admin") {
      const body = (await request.json()) as any;
      const {
        getRaffleState,
        updateRaffleSettings,
        setRaffleWinner,
        removeRaffleEntry,
        clearAllRaffleEntries,
      } = await import("@/server/raffleStore");

      if (body.action === "update-settings") {
        const targetId = body.raffleId || body.id;
        const updated = await updateRaffleSettings({
          id: targetId,
          title: String(body.title || "Community Heroes Grand Raffle"),
          category: body.category ? String(body.category) : undefined,
          description: String(body.description || ""),
          cutoffDate: String(body.cutoffDate || ""),
          prizes: Array.isArray(body.prizes) ? body.prizes : [],
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        });
        return json({ success: true, raffle: updated });
      }

      if (body.action === "assign-winner") {
        if (!body.entryId) return json({ error: "Missing entryId." }, 400);
        await setRaffleWinner(body.entryId, body.prizeWon || null);
        const raffle = await getRaffleState(body.raffleId || "latest");
        return json({ success: true, raffle });
      }

      if (body.action === "delete-entry") {
        if (!body.entryId) return json({ error: "Missing entryId." }, 400);
        await removeRaffleEntry(body.entryId);
        const raffle = await getRaffleState(body.raffleId || "latest");
        return json({ success: true, raffle });
      }

      if (body.action === "clear-entries") {
        await clearAllRaffleEntries(body.raffleId || "default");
        const raffle = await getRaffleState(body.raffleId || "latest");
        return json({ success: true, raffle });
      }

      if (body.action === "create-raffle") {
        const { createNewRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        const created = await createNewRaffle({
          title: String(body.title || "Community Heroes Grand Raffle"),
          category: body.category ? String(body.category) : "Diamonds Giveaway",
          description: String(body.description || ""),
          cutoffDate: String(body.cutoffDate || new Date(Date.now() + 14 * 86400000).toISOString()),
          prizes: Array.isArray(body.prizes)
            ? body.prizes
            : [
                { name: "100 Diamonds", winnerCount: 5 },
                { name: "Starlight Card", winnerCount: 1 },
              ],
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        });
        const archives = await getArchivedRaffles();
        return json({ success: true, raffle: created, archives });
      }

      if (body.action === "delete-raffle") {
        const { deleteRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        const res = await deleteRaffle(body.raffleId);
        const archives = await getArchivedRaffles();
        return json({ success: true, raffle: res.nextRaffle, archives });
      }

      if (body.action === "delete-archive") {
        if (!body.archiveId) return json({ error: "Missing archiveId." }, 400);
        const { deleteArchivedRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        await deleteArchivedRaffle(body.archiveId);
        const archives = await getArchivedRaffles();
        return json({ success: true, archives });
      }

      if (body.action === "edit-archive") {
        if (!body.archiveId) return json({ error: "Missing archiveId." }, 400);
        const { editArchivedRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        await editArchivedRaffle(
          body.archiveId,
          String(body.title || "Archived Raffle"),
          String(body.description || ""),
        );
        const archives = await getArchivedRaffles();
        return json({ success: true, archives });
      }

      if (body.action === "restore-archive") {
        if (!body.archiveId) return json({ error: "Missing archiveId." }, 400);
        const { restoreArchivedRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        const res = await restoreArchivedRaffle(body.archiveId);
        const archives = await getArchivedRaffles();
        return json({ success: true, raffle: res.restoredRaffle, archives });
      }

      if (body.action === "add-entry") {
        const fullName = String(body.fullName || "").trim();
        if (!fullName) return json({ error: "Please provide a full name." }, 400);
        const { submitRaffleEntry, getRaffleState } = await import("@/server/raffleStore");
        const res = await submitRaffleEntry(body.raffleId || "default", fullName);
        if (!res.success) return json({ error: res.error || "Could not add entry." }, 400);
        const raffle = await getRaffleState(body.raffleId || "latest");
        return json({ success: true, raffle });
      }

      if (body.action === "archive-and-new") {
        const { archiveCurrentRaffle, getArchivedRaffles } = await import("@/server/raffleStore");
        const res = await archiveCurrentRaffle(body.raffleId, {
          title: body.title,
          category: body.category,
          description: body.description,
          cutoffDate: body.cutoffDate,
          prizes: body.prizes,
        });
        const archives = await getArchivedRaffles();
        return json({ success: true, raffle: res.newRaffle, archives });
      }

      if (body.action === "get-archives") {
        const { getArchivedRaffles } = await import("@/server/raffleStore");
        const archives = await getArchivedRaffles();
        return json({ success: true, archives });
      }

      return json({ error: "Unknown raffle admin action." }, 400);
    }
    return json({ error: "Endpoint not found." }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues[0]?.message || "Invalid input." }, 400);
    console.error(error);
    return json(
      {
        error: "The update failed. Your saved directory has not been replaced.",
      },
      500,
    );
  }
}
