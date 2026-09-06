import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Community Heroes — Your next great game starts here.",
    template: "%s | Community Heroes",
  },
  description:
    "Find your local MLBB community tournament. Meet your Community Hero, discover available team slots, and take your squad to the next level.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
