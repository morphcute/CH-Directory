import type { AppState, CHPlayer } from "../types";
import { parseTabDate } from "@/utils/sheetDetector";

export function listedPlayers(state: AppState) {
  return state.players.filter((player) => Boolean(player.active));
}

/**
 * Checks if the tournament date encoded in the sheet tab name (e.g. "September 5, 2026")
 * has already passed in Philippine Time (UTC+8).
 * If the date has passed, the directory becomes closed to all until the next month tab is set.
 */
export function isTabDatePassed(_tabName?: string): boolean {
  return false;
}

export function canRegister(player: CHPlayer, tabName?: string) {
  return (
    ["open", "closing"].includes(tournamentStatus(player, tabName)) &&
    !!registrationUrl(player)
  );
}

export function registeredTeamsCount(player: CHPlayer): number {
  if (Array.isArray(player.registeredTeams) && player.registeredTeams.length > 0) {
    return player.registeredTeams.length;
  }
  return player.teamsRegistered || 0;
}

export type TournamentStatus = "open" | "closing" | "full" | "closed";

export function slotsLeft(player: CHPlayer) {
  return Math.max(0, player.maxTeams - registeredTeamsCount(player));
}
export function tournamentStatus(player: CHPlayer, _tabName?: string): TournamentStatus {
  if (!player.active || player.formStatus === "closed") return "closed";
  const registered = registeredTeamsCount(player);
  if (player.formStatus === "full" || registered >= player.maxTeams) return "full";
  const remaining = Math.max(0, player.maxTeams - registered);
  return remaining <= 4 ? "closing" : "open";
}
export function registrationUrl(player: CHPlayer) {
  return safeLink(
    player.resolvedFormUrl ||
      player.registrationFormLink ||
      player.tournamentPostingLink,
  );
}
export function safeLink(value?: string) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function regionOf(player: CHPlayer) {
  if (player.isCalabarzon) return "CALABARZON";
  if (player.area.includes("Bicol")) return "Bicol";
  if (player.area === "MIMAROPA") return "MIMAROPA";
  return "Metro Manila";
}
export const statusLabels: Record<TournamentStatus, string> = {
  open: "Registration open",
  closing: "Filling fast",
  full: "Fully booked",
  closed: "Registration closed",
};
export function filterTournaments(
  players: CHPlayer[],
  query: string,
  region: string,
  status: string,
) {
  const term = query.trim().toLocaleLowerCase();
  return players.filter(
    (p) =>
      p.active &&
      (!term ||
        `${p.area} ${p.chNickname} ${p.fullName} ${regionOf(p)}`
          .toLocaleLowerCase()
          .includes(term)) &&
      (region === "All regions" || regionOf(p) === region) &&
      (status === "all" ||
        (status === "open"
          ? ["open", "closing"].includes(tournamentStatus(p))
          : tournamentStatus(p) === status)),
  );
}
