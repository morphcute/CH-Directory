import type { Metadata } from "next";
import { Admin } from "@/features/Admin";
export const metadata: Metadata = {
  title: "Organizer workspace",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <Admin />;
}
