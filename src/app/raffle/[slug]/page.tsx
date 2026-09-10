import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RafflePage } from "@/features/RafflePage";
import { raffleTitleSlug } from "@/lib/raffles";
import { getActiveRaffles } from "@/server/raffleStore";
import { readState } from "@/server/store";

export const dynamic = "force-dynamic";

async function resolveActiveRaffle(slug: string) {
  const activeRaffles = await getActiveRaffles();
  return activeRaffles.find(
    (raffle) => raffleTitleSlug(raffle.title) === slug,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await resolveActiveRaffle(slug);

  if (!raffle) {
    return { title: "Raffle not found | MLBB Community Heroes" };
  }

  return {
    title: `${raffle.title} | MLBB Community Heroes`,
    description: raffle.description,
  };
}

export default async function RaffleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const raffle = await resolveActiveRaffle(slug);
  if (!raffle) notFound();

  const appState = await readState();
  return <RafflePage initialAppState={appState} raffleId={raffle.id} />;
}
