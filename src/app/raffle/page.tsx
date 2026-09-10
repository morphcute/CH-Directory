import type { Metadata } from "next";
import { RafflePage } from "@/features/RafflePage";
import { readState } from "@/server/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Community Raffle Lobby | MLBB Community Heroes",
    description:
      "Choose an active Community Heroes raffle, view its prizes, and place your entry.",
  };
}

export default async function Page() {
  const appState = await readState();
  return <RafflePage initialAppState={appState} />;
}
