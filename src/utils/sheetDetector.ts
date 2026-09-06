import { CHPlayer, SheetTab } from "../types";

export const CALABARZON_PROVINCES = [
  "Cavite",
  "Laguna",
  "Batangas",
  "Rizal",
  "Quezon Province",
  "Quezon",
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Checks if an area belongs to the CALABARZON region
 */
export function isCalabarzonArea(area: string): boolean {
  if (!area) return false;
  const cleaned = area.trim().toLowerCase();
  return CALABARZON_PROVINCES.some((prov) =>
    cleaned.includes(prov.toLowerCase()),
  );
}

/**
 * Extracts Google Spreadsheet ID from link
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If it's already an alphanumeric ID
  if (/^[a-zA-Z0-9-_]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  // Match /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Parses tab name to extract month and year
 * e.g., "September 5, 2026", "September 5 2026", "August 5, 2026"
 */
export function parseTabDate(
  tabName: string,
): {
  monthIndex: number;
  monthName: string;
  day?: number;
  year: number;
} | null {
  if (!tabName) return null;

  // Try matching Month Name + Day + Year: e.g. "September 5, 2026" or "Sept 5 2026"
  for (let i = 0; i < 12; i++) {
    const full = MONTH_NAMES[i];
    const short = MONTH_SHORT[i];
    const regex = new RegExp(
      `\\b(${full}|${short})\\b(?:[\\s,]+(\\d{1,2}))?(?:[\\s,]+(\\d{4}))?`,
      "i",
    );
    const match = tabName.match(regex);
    if (match) {
      const day = match[2] ? parseInt(match[2], 10) : undefined;
      const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      return {
        monthIndex: i,
        monthName: full,
        day,
        year,
      };
    }
  }

  // Fallback: Check for MM-YYYY or YYYY-MM
  const numMatch =
    tabName.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/) ||
    tabName.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (numMatch) {
    const isYearFirst = numMatch[1].length === 4;
    const year = parseInt(isYearFirst ? numMatch[1] : numMatch[2], 10);
    const m = parseInt(isYearFirst ? numMatch[2] : numMatch[1], 10) - 1;
    return {
      monthIndex: m,
      monthName: MONTH_NAMES[m],
      year,
    };
  }

  return null;
}

/**
 * Detects tabs and marks the one matching the target or current month
 */
export function analyzeTabs(
  tabNames: string[],
  targetDate: Date = new Date(),
): { tabs: SheetTab[]; autoDetectedTab: SheetTab | null } {
  const currentMonthIndex = targetDate.getMonth();
  const currentYear = targetDate.getFullYear();

  const tabs: SheetTab[] = tabNames.map((name) => {
    const parsed = parseTabDate(name);
    const monthIndex = parsed ? parsed.monthIndex : -1;
    const monthName = parsed ? parsed.monthName : "Unknown";
    const year = parsed ? parsed.year : currentYear;
    const day = parsed?.day;

    const isCurrentMonth =
      monthIndex === currentMonthIndex &&
      (parsed ? parsed.year === currentYear : true);

    return {
      name,
      monthName,
      monthIndex,
      day,
      year,
      isCurrentMonth,
    };
  });

  // Find auto-detected tab: first priority is matching current month and year
  let autoDetected = tabs.find((t) => t.isCurrentMonth) || null;

  // If not exact year, just match current month
  if (!autoDetected) {
    autoDetected = tabs.find((t) => t.monthIndex === currentMonthIndex) || null;
  }

  // If still none, pick the latest tab
  if (!autoDetected && tabs.length > 0) {
    autoDetected = tabs[tabs.length - 1];
  }

  return { tabs, autoDetectedTab: autoDetected };
}

/**
 * Parses Google Visualization JSON response
 */
export function parseGvizResponse(rawText: string): any[][] {
  try {
    // GViz format: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    const jsonStr = rawText
      .replace(/^[/*\w\s.]*\(/, "")
      .replace(/\);?\s*$/, "");
    const data = JSON.parse(jsonStr);
    const rows = data.table?.rows || [];

    return rows.map((r: any) => {
      const c = r.c || [];
      return c.map((cell: any) => (cell && cell.v !== undefined ? cell.v : ""));
    });
  } catch (err) {
    console.error("Error parsing GViz response:", err);
    return [];
  }
}

/**
 * Converts raw rows into CHPlayer models
 * Handles Column A (Active), Column B (Area), Column C (Full Name), Column D (Nickname),
 * Column F (Registration Form Link), and Column G (Tournament Response Sheet)
 */
export function transformRowsToPlayers(rows: any[][]): CHPlayer[] {
  const players: CHPlayer[] = [];
  let lastSeenArea = "";

  // Inspect starting row
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const rowStr = rows[i].map((c) => String(c).toLowerCase()).join(" ");
    if (
      rowStr.includes("nickname") ||
      rowStr.includes("registration") ||
      rowStr.includes("response sheet") ||
      rowStr.includes("area")
    ) {
      headerIndex = i;
      break;
    }
  }

  const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Col A (0): Active indicator (1 or blank)
    const colA = String(row[0] || "").trim();
    // Col B (1): Area
    const colB = String(row[1] || "").trim();
    // Col C (2): CH Full Name
    const colC = String(row[2] || "").trim();
    // Col D (3): CH Nickname (can be `=HYPERLINK("fb_url", "nickname")`, `<a href="...">`, or plain text)
    const rawColD = String(row[3] || "").trim();
    let nickname = rawColD;
    let fbProfileUrl = "";

    // Check if colD is a formula =HYPERLINK("url", "text")
    const formulaMatch = rawColD.match(
      /=HYPERLINK\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/i,
    );
    if (formulaMatch) {
      fbProfileUrl = formulaMatch[1].trim();
      nickname = formulaMatch[2].trim();
    } else {
      // Check for HTML link <a href="url">text</a>
      const htmlMatch = rawColD.match(
        /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i,
      );
      if (htmlMatch) {
        fbProfileUrl = htmlMatch[1].trim();
        nickname = htmlMatch[2].trim();
      } else {
        // Check for "Nickname (url)" format
        const parenMatch = rawColD.match(/^(.*?)\s*\((https?:\/\/[^\s)]+)\)/i);
        if (parenMatch) {
          nickname = parenMatch[1].trim();
          fbProfileUrl = parenMatch[2].trim();
        }
      }
    }

    // In the user's sheet layout:
    // Col F (index 5) is Registration Form Link
    // Col G (index 6) is Tournament Response Sheet
    // If standard 5-col layout, fallback to index 4 / 5
    let regLink = "";
    let responseLink = "";

    if (row.length >= 7) {
      regLink = String(row[5] || "").trim();
      responseLink = String(row[6] || "").trim();
    } else if (row.length >= 5) {
      regLink = String(row[4] || "").trim();
      responseLink = String(row[5] || "").trim();
    }

    // In Google Sheets, merged cells for AREA mean colB might be blank on subsequent rows
    if (colB) {
      lastSeenArea = colB;
    }
    const area = colB || lastSeenArea;

    // Skip empty separator rows
    if (!colC && !nickname && !regLink) continue;

    const isActive =
      colA === "1" ||
      colA.toLowerCase() === "active" ||
      colA.toLowerCase() === "yes" ||
      colA.toLowerCase() === "true";
    const isCalabarzon = isCalabarzonArea(area);
    if (!nickname) {
      nickname = colC.split(" ")[0] || "Player";
    }

    // Parse team count dynamically from row if present, otherwise default to 0 registered (Open)
    let initialTeams = 0;
    let maxTeams = 16;

    if (row.length >= 5 && row[4] !== undefined) {
      const colVal = String(row[4]).trim();
      const match = colVal.match(/^(\d+)(?:\s*\/\s*(\d+))?/);
      if (match) {
        initialTeams = parseInt(match[1], 10) || 0;
        if (match[2]) {
          maxTeams = parseInt(match[2], 10) || 16;
        }
      } else if (colVal.toLowerCase().includes("full")) {
        initialTeams = 16;
        maxTeams = 16;
      }
    }

    players.push({
      id: `row-${i}-${rawColD || colC || i}`,
      active: isActive,
      area: area || "Unassigned",
      isCalabarzon,
      fullName: colC,
      chNickname: nickname,
      facebookProfileUrl: fbProfileUrl,
      registrationFormLink: regLink,
      tournamentPostingLink: regLink,
      tournamentResponseSheet: responseLink,
      teamsRegistered: initialTeams,
      maxTeams: maxTeams,
      rowIndex: i + 1,
    });
  }

  return players;
}

/**
 * Parses raw CSV or Tab-Separated Text (e.g. pasted directly from Google Sheets or Excel)
 */
export function parseCsvOrTsv(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, "");
  const delimiter = text.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const finishRow = () => {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell.length === 0) quoted = !quoted;
      else cell += char;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else cell += char;
  }
  if (quoted)
    throw new Error(
      "A quoted cell is incomplete. Copy the full rows and try again.",
    );
  if (cell.length || row.length) finishRow();
  return rows;
}

/**
 * Fetches Google Sheet data using the server-side proxy (bypassing CORS) or direct GViz
 */
export async function fetchGoogleSheetData(
  spreadsheetUrlOrId: string,
  tabName?: string,
): Promise<{ rows: any[][]; source: string }> {
  const sheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!sheetId) {
    throw new Error("Please enter a valid Google Spreadsheet URL or ID.");
  }

  // 1. First attempt: Use our server-side API proxy (No browser CORS restriction!)
  try {
    const proxyUrl = `/api/sheets/data?url=${encodeURIComponent(spreadsheetUrlOrId)}${
      tabName ? `&sheet=${encodeURIComponent(tabName)}` : ""
    }`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.status === 403) {
      const data = await proxyRes.json();
      throw new Error(
        data.message ||
          'This Google Sheet is currently Restricted/Private. Please set Share settings to "Anyone with the link can view", or use the Direct Paste box below.',
      );
    }
    if (proxyRes.ok) {
      const text = await proxyRes.text();
      const rows = parseGvizResponse(text);
      if (rows && rows.length > 0) {
        return { rows, source: "server-proxy" };
      }
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("Restricted") || err.message.includes("Private"))
    ) {
      throw err;
    }
    console.warn(
      "Server proxy fetch failed, attempting client fallback...",
      err,
    );
  }

  // 2. Direct client fallback (GViz)
  try {
    const gvizUrl = tabName
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      const rows = parseGvizResponse(text);
      if (rows && rows.length > 0) {
        return { rows, source: "gviz" };
      }
    }
  } catch (err) {
    console.warn("Direct GViz fetch failed...", err);
  }

  // 3. Fallback to CSV export
  try {
    const csvUrl = tabName
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`
      : `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    const csvRes = await fetch(csvUrl);
    if (csvRes.ok) {
      const csvText = await csvRes.text();
      const rows = parseCsvOrTsv(csvText);
      if (rows && rows.length > 0) {
        return { rows, source: "csv" };
      }
    }
  } catch {}

  throw new Error(
    'Cannot access this Google Sheet. The sheet is Restricted. Please click "Sign in with Google" above to grant access with your editor account, OR set the sheet to "Anyone with the link can view", or use the Direct Paste box.',
  );
}

/**
 * Fetches sheet tabs metadata via Google Sheets REST API v4 using OAuth access token
 */
export async function fetchGoogleSheetsApiTabs(
  spreadsheetUrlOrId: string,
  accessToken: string,
): Promise<SheetTab[]> {
  const sheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!sheetId) throw new Error("Invalid spreadsheet ID");

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      `Google Sheets API returned HTTP ${res.status}`;
    throw new Error(message);
  }

  const data = await res.json();
  const sheets = data.sheets || [];

  return sheets.map((s: any) => {
    const title = s.properties?.title || "Sheet";
    return {
      id: String(s.properties?.sheetId ?? title),
      name: title,
      dateObj: parseTabDate(title),
    };
  });
}

/**
 * Fetches sheet rows via Google Sheets REST API v4 using OAuth access token
 */
export async function fetchGoogleSheetsApiRows(
  spreadsheetUrlOrId: string,
  tabName: string,
  accessToken: string,
): Promise<any[][]> {
  const sheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!sheetId) throw new Error("Invalid spreadsheet ID");

  const encodedRange = encodeURIComponent(tabName);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      `Google Sheets API returned HTTP ${res.status}`;
    throw new Error(message);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Fetches the master application state from the server database
 */
export async function fetchAppStateFromServer(): Promise<any | null> {
  try {
    const res = await fetch("/api/app-state");
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Could not fetch app state from server:", err);
  }
  return null;
}

/**
 * Saves the master application state to the server database
 */
export async function saveAppStateToServer(state: any): Promise<boolean> {
  try {
    const res = await fetch("/api/app-state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to save app state to server:", err);
    return false;
  }
}

/**
 * Checks if server state has been updated
 */
export async function checkAppStateSync(): Promise<{
  lastUpdated: number;
  count: number;
} | null> {
  try {
    const res = await fetch("/api/app-state/sync");
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

/**
 * Runs full tournament detection on the server (resolves shortened URLs,
 * counts response sheet teams e.g. 16/16, and detects if registration forms are closed).
 */
export async function detectTournamentStatusServer(
  players: CHPlayer[],
  accessToken?: string | null,
): Promise<{ players: CHPlayer[]; timestamp: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch("/api/detect-tournament-status", {
    method: "POST",
    headers,
    body: JSON.stringify({ players }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Detection failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    players: data.players || players,
    timestamp: data.timestamp || new Date().toLocaleTimeString(),
  };
}

/**
 * Fetches team submission count from a Google Form Response Sheet (Column G)
 * Handles shortened URLs (tinyurl, bitly) by delegating to server resolver.
 */
export async function fetchResponseSheetTeamCount(
  responseSheetUrl: string,
  accessToken?: string | null,
): Promise<number | null> {
  if (!responseSheetUrl) return null;

  // 1. Try server detect-responses first to resolve shortened URLs and bypass CORS
  try {
    const res = await fetch("/api/sheets/detect-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "single", nickname: "target", responseSheetUrl }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const first = data.results?.[0];
      if (first && typeof first.count === "number") {
        return first.count;
      }
    }
  } catch {}

  const sheetId = extractSpreadsheetId(responseSheetUrl);
  if (!sheetId) return null;

  // 2. If accessToken provided, use official API v4
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const rows = data.values || [];
        if (rows.length > 1) {
          return Math.max(0, rows.length - 1);
        }
        return 0;
      }
    } catch {}
  }

  // 3. Fallback to direct GViz
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
    const res = await fetch(gvizUrl);
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseGvizResponse(text);
    if (rows && rows.length > 1) {
      return Math.max(0, rows.length - 1);
    }
    return 0;
  } catch {
    return null;
  }
}
