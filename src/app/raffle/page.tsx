import type { Metadata } from "next";
import { RafflePage } from "@/features/RafflePage";

export const metadata: Metadata = {
  title: "Community Raffle | MLBB Community Heroes",
  description:
    "Join the official Community Heroes raffle! Enter your Full Name to participate and win exclusive MLBB diamonds, Starlight memberships, and rewards.",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <RafflePage />;
}
