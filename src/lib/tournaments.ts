import type { AppState, CHPlayer } from "../types";

export function listedPlayers(state: AppState) {
  return state.players.filter((player) => Boolean(player.active));
}

export function canRegister(player: CHPlayer) {
  return (
    ["open", "closing"].includes(tournamentStatus(player)) &&
    !!registrationUrl(player)
  );
}

export type TournamentStatus = "open" | "closing" | "full" | "closed";
export function slotsLeft(player: CHPlayer) {
  return Math.max(0, player.maxTeams - player.teamsRegistered);
}
export function tournamentStatus(player: CHPlayer): TournamentStatus {
  if (!player.active || player.formStatus === "closed") return "closed";
  if (player.formStatus === "full" || slotsLeft(player) === 0) return "full";
  return slotsLeft(player) <= 4 ? "closing" : "open";
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
export const statusLabels = {
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
