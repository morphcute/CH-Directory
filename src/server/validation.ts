import { z } from "zod";
const link = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Enter a valid HTTP or HTTPS link.");
export const playerSchema = z.object({
  id: z.string().min(1).max(100),
  active: z.boolean(),
  area: z.string().min(1).max(150),
  isCalabarzon: z.boolean().optional(),
  fullName: z.string().min(1).max(200),
  chNickname: z.string().min(1).max(80),
  facebookProfileUrl: link.optional(),
  registrationFormLink: link,
  tournamentPostingLink: link,
  tournamentResponseSheet: link,
  teamsRegistered: z.number().int().min(0).max(10000),
  maxTeams: z.number().int().min(1).max(1024),
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
});
export const updateSchema = z.object({
  players: z
    .array(playerSchema)
    .max(500)
    .refine(
      (players) => new Set(players.map((p) => p.id)).size === players.length,
      "Tournament IDs must be unique.",
    )
    .optional(),
  selectedNicknames: z.array(z.string().max(80)).max(500).optional(),
  activeTabName: z.string().min(1).max(150).optional(),
  spreadsheetUrl: link.optional(),
  rawTabsList: z.array(z.string().max(150)).max(200).optional(),
  lastHourlySync: z.number().optional(),
  googleAccessToken: z.string().optional(),
  logoUrl: z.string().max(5000000).optional(),
  bannerUrl: z.string().max(5000000).optional(),
  bannerSettings: z.any().optional(),
}).passthrough();
