import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "CH Directory",
  title: {
    default: "CH Directory — Community Heroes Tournament Directory",
    template: "%s | CH Directory",
  },
  description:
    "CH Directory: Find your local MLBB community tournament. Meet your Community Hero, discover available team slots, and take your squad to the next level.",
  icons: {
    icon: [
      { url: "/images/mlbb-ch-avatar.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/images/mlbb-ch-avatar.png",
    shortcut: "/images/mlbb-ch-avatar.png",
  },
  openGraph: {
    siteName: "CH Directory",
    title: "CH Directory — Community Heroes Tournament Directory",
    description:
      "Find your local MLBB community tournament. Meet your Community Hero, discover available team slots, and take your squad to the next level.",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
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
