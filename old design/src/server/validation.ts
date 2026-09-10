import { z } from "zod";

function sanitizeUrlString(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  let s = value.trim();
  const formulaMatch = s.match(/=HYPERLINK\s*\(\s*["']([^"']+)["']/i);
  if (formulaMatch) s = formulaMatch[1].trim();
  const htmlMatch = s.match(/href=["']([^"']+)["']/i);
  if (htmlMatch) s = htmlMatch[1].trim();
  const mdMatch = s.match(/\((https?:\/\/[^\s)]+)\)/i);
  if (mdMatch) s = mdMatch[1].trim();
  return s;
}

const link = z.preprocess(
  sanitizeUrlString,
  z
    .string()
    .max(2048)
    .refine((value) => {
      if (!value) return true;
      try {
        return ["https:", "http:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, "Enter a valid HTTP or HTTPS link."),
);
export const playerSchema = z.object({
  id: z.string().max(100).default(() => `player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
  active: z.boolean().default(true),
  area: z.string().max(150).default("Unassigned"),
  isCalabarzon: z.boolean().optional(),
  fullName: z.string().max(200).default(""),
  chNickname: z.string().max(80).default(""),
  facebookProfileUrl: link.optional(),
  registrationFormLink: link.optional().default(""),
  tournamentPostingLink: link.optional().default(""),
  tournamentResponseSheet: link.optional().default(""),
  teamsRegistered: z.number().int().min(0).max(10000).default(0),
  maxTeams: z.number().int().min(1).max(1024).default(16),
  lastDetectedAt: z.string().max(100).optional(),
  remarks: z.string().max(3000).optional(),
  rowIndex: z.number().optional(),
  avatarUrl: link.optional(),
  formStatus: z
    .enum(["open", "closed", "full", "error", "checking"])
    .optional(),
  formStatusDetail: z.string().max(1000).optional(),
  resolvedResponseSheetUrl: link.optional(),
  resolvedFormUrl: link.optional(),
  registeredTeams: z.array(z.string().max(200)).max(128).optional(),
  prlCutoff: z.string().max(500).optional(),
});
export const updateSchema = z.object({
  prlCutoff: z.string().max(500).optional(),
  players: z
    .array(playerSchema)
    .max(500)
    .refine(
      (players) => new Set(players.map((p) => p.id)).size === players.length,
      "Tournament IDs must be unique.",
    )
    .optional(),
  selectedNicknames: z.array(z.string().max(80)).max(500).optional(),
  activeTabName: z.string().max(150).optional().default(""),
  spreadsheetUrl: link.optional(),
  rawTabsList: z.array(z.string().max(150)).max(200).optional(),
  lastHourlySync: z.number().optional(),
  googleAccessToken: z.string().optional(),
  googleRefreshToken: z.string().optional(),
  googleConnectedEmail: z.string().optional(),
  googleTokenExpiresAt: z.number().optional(),
  logoUrl: z.string().max(5000000).optional(),
  bannerUrl: z.string().max(5000000).optional(),
  bannerSettings: z.any().optional(),
}).passthrough();

