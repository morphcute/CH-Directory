import { Portal } from "@/features/Portal";
import { readState } from "@/server/store";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <Portal initialState={await readState()} />;
}
