import { NextResponse } from "next/server";
import { readState, saveState } from "@/server/store";
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

// Start server background sync timer (runs hourly even if admin logged out)
ensureSyncSchedulerRunning();

type Context = { params: Promise<{ path: string[] }> };
const attempts = new Map<string, { count: number; reset: number }>();
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, context: Context) {
  const route = (await context.params).path.join("/");
  try {
    if (route === "health") return json({ status: "ok", framework: "Next.js" });
    if (route === "auth")
      return json({
        authenticated: await isOrganizer(),
        configured: authConfigured(),
        adminEmail: ADMIN_EMAIL,
      });
    if (route === "app-state") {
      void checkAndTriggerHourlySync();
      return json(await readState());
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
