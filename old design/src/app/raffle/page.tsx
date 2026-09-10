import type { Metadata } from "next";
import { RafflePage } from "@/features/RafflePage";
import { readState } from "@/server/store";

import { getRaffleState } from "@/server/raffleStore";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const raffle = await getRaffleState("default").catch(() => null);
  const title = raffle?.title
    ? `${raffle.title} | MLBB Community Heroes`
    : "Community Raffle | MLBB Community Heroes";
  const description =
    raffle?.description ||
    "Join the official Community Heroes raffle! Enter your Full Name to participate and win exclusive MLBB diamonds, Starlight memberships, and rewards.";
  return {
    title,
    description,
  };
}

export default async function Page() {
  const appState = await readState();
  return <RafflePage initialAppState={appState} />;
}
