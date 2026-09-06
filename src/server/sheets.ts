import { extractSpreadsheetId, parseCsvOrTsv } from "@/utils/sheetDetector";
import type { CHPlayer } from "@/types";

const allowedHosts = new Set([
  "docs.google.com",
  "forms.google.com",
  "forms.gle",
  "tinyurl.com",
  "www.tinyurl.com",
  "bit.ly",
  "www.bit.ly",
]);
export function allowedRemote(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !allowedHosts.has(url.hostname)
  )
    throw new Error(
      "Only Google Sheets, Google Forms, TinyURL, and Bitly links are supported.",
    );
  return url;
}
export async function safeFetch(value: string): Promise<Response> {
  let url = allowedRemote(value);
  for (let i = 0; i < 6; i++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "CommunityHeroes/1.0" },
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location)
        throw new Error("This link redirects without a destination.");
      url = allowedRemote(new URL(location, url).href);
      continue;
    }
    if (!response.ok)
      throw new Error(
        `The source returned HTTP ${response.status}. Check its sharing permissions.`,
      );
    return response;
  }
  throw new Error(
    "This link redirects too many times. Use the original Google URL.",
  );
}
export async function sheetRows(value: string, tab?: string, token?: string) {
  const id = extractSpreadsheetId(value);
  if (!id || !/^[\w-]+$/.test(id))
    throw new Error("Enter a valid Google Sheets URL.");
  if (token) {
    const range = tab ? `'${tab.replace(/'/g, "''")}'!A:Z` : "A:Z";
    const bearer = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    // 1. First attempt: Fetch full grid data to extract rich cell hyperlinks (for Facebook links)
    try {
      const detailRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?ranges=${encodeURIComponent(range)}&fields=sheets.data.rowData.values(formattedValue,hyperlink,userEnteredValue)`,
        {
          headers: { Authorization: bearer },
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        },
      );
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        const rowData = detailJson.sheets?.[0]?.data?.[0]?.rowData;
        if (Array.isArray(rowData) && rowData.length > 0) {
          return rowData.map((r: any) => {
            const vals = r.values || [];
            return vals.map((cell: any) => {
              if (!cell) return "";
              if (cell.hyperlink) {
                const text = cell.formattedValue || "";
                return `=HYPERLINK("${cell.hyperlink}", "${text.replace(/"/g, '""')}")`;
              }
              if (cell.userEnteredValue?.formulaValue) {
                return cell.userEnteredValue.formulaValue;
              }
              return cell.formattedValue !== undefined ? cell.formattedValue : "";
            });
          });
        }
      }
    } catch {
      // Fallback to standard values endpoint
    }

    // 2. Standard values endpoint fallback
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: bearer },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      },
    );
    if (!res.ok)
      throw new Error(
        "Google could not read this sheet. Sign in again or check sharing permissions.",
      );
    return (await res.json()).values || [];
  }
  const res = await safeFetch(
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${tab ? `&sheet=${encodeURIComponent(tab)}` : ""}`,
  );
  const content = await res.text();
  if (content.trimStart().startsWith("<"))
    throw new Error(
      "This spreadsheet is private. Sign in with Google or paste the sheet data.",
    );
  return parseCsvOrTsv(content);
}
export async function inspectPlayer(
  player: CHPlayer,
  token?: string,
): Promise<CHPlayer> {
  const updated = { ...player };
  const errors: string[] = [];
  if (player.tournamentResponseSheet) {
    try {
      let url = player.tournamentResponseSheet;
      if (!url.includes("docs.google.com/spreadsheets/d/"))
        url = (await safeFetch(url)).url;
      const rows: unknown[][] = await sheetRows(url, undefined, token);
      const nonempty = rows.filter((row) =>
        row.some(
          (cell) => cell !== null && cell !== undefined && String(cell).trim(),
        ),
      );
      updated.teamsRegistered = Math.max(0, nonempty.length - 1);
      updated.resolvedResponseSheetUrl = url;
      if (rows.length > 1) {
        const header = (rows[0] as unknown[]).map((c: unknown) => String(c || "").trim());
        let teamColIdx = header.findIndex((col: string) =>
          /team\s*name|pangalan\s*ng\s*team|squad\s*name|name\s*of\s*team|team|squad|koponan/i.test(col),
        );
        if (teamColIdx === -1) {
          const ignore = /timestamp|date|time|email|phone|contact|number|fb|facebook|id/i;
          teamColIdx = header.findIndex((col: string) => !ignore.test(col));
        }
        if (teamColIdx === -1 || (teamColIdx === 0 && header.length > 1)) {
          teamColIdx = 1;
        }
        const extracted: string[] = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] as unknown[];
          const val = row[teamColIdx];
          const tName = val !== null && val !== undefined ? String(val).trim() : "";
          if (tName && !extracted.includes(tName)) extracted.push(tName);
        }
        if (extracted.length > 0) updated.registeredTeams = extracted;
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  const link = player.registrationFormLink || player.tournamentPostingLink;
  if (link) {
    try {
      const res = await safeFetch(link);
      const html = (await res.text()).toLowerCase();
      updated.resolvedFormUrl = res.url;
      if (
        html.includes("no longer accepting responses") ||
        html.includes("hindi na tumatanggap ng mga tugon")
      )
        updated.formStatus = "closed";
      else if (
        res.url.includes("docs.google.com/forms/") &&
        /<form\b/.test(html)
      )
        updated.formStatus = "open";
      else errors.push("Confirm registration status with the organizer.");
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  if (updated.teamsRegistered >= updated.maxTeams) updated.formStatus = "full";
  if (errors.length) {
    updated.formStatusDetail = errors.join(" ");
    if (updated.formStatus !== "closed" && updated.formStatus !== "full")
      updated.formStatus = "error";
  } else {
    updated.formStatusDetail = "Source checked successfully";
    updated.lastDetectedAt =
      new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()) + " PHT";
  }
  return updated;
}

export async function fetchTeamsFromResponseSheet(
  sheetUrl: string,
  token?: string,
): Promise<string[]> {
  let url = sheetUrl.trim();
  if (!url.includes("docs.google.com/spreadsheets/d/")) {
    const res = await safeFetch(url);
    url = res.url;
  }
  const rows = (await sheetRows(url, undefined, token)) as unknown[][];
  if (!rows || rows.length <= 1) return [];

  const header = (rows[0] as unknown[]).map((c: unknown) => String(c || "").trim());
  let teamColIdx = header.findIndex((col: string) =>
    /team\s*name|pangalan\s*ng\s*team|squad\s*name|name\s*of\s*team|team|squad|koponan/i.test(col),
  );

  if (teamColIdx === -1) {
    const ignore = /timestamp|date|time|email|phone|contact|number|fb|facebook|id/i;
    teamColIdx = header.findIndex((col: string) => !ignore.test(col));
  }

  if (teamColIdx === -1 || (teamColIdx === 0 && header.length > 1)) {
    teamColIdx = 1;
  }

  const teams: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const val = row[teamColIdx];
    const teamName = val !== null && val !== undefined ? String(val).trim() : "";
    if (teamName && !teams.includes(teamName)) {
      teams.push(teamName);
    }
  }
  return teams;
}
