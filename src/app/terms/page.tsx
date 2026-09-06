import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Brand, Footer } from "@/features/shared";

export const metadata: Metadata = {
  title: "Terms of Service | Community Heroes",
  description: "Terms of Service for the Community Heroes Tournament Directory.",
};

export default function TermsPage() {
  return (
    <div className="layout">
      <header className="header">
        <Brand />
        <Link href="/" className="button outline small">
          <ArrowLeft size={14} /> Back to Directory
        </Link>
      </header>

      <main style={{ maxWidth: 840, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#252210",
              border: "1px solid #5a4b12",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#facc15",
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <span className="eyebrow">LEGAL & GUIDELINES</span>
            <h1 style={{ fontSize: "2rem", margin: 0, color: "#f8fafc" }}>Terms of Service</h1>
          </div>
        </div>

        <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: 32 }}>
          Last updated: September 7, 2026
        </p>

        <div
          style={{
            background: "#121824",
            border: "1px solid #222d3e",
            borderRadius: 16,
            padding: "32px",
            lineHeight: 1.7,
            color: "#cbd5e1",
            fontSize: "14px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px", marginTop: 0 }}>1. Agreement to Terms</h2>
            <p>
              By accessing or using the <strong>Community Heroes Tournament Directory</strong> at <code>ch-directory.sbs</code>,
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our website.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>2. Purpose of the Directory</h2>
            <p>
              This directory serves as a central hub connecting Mobile Legends: Bang Bang (MLBB) competitive players with verified
              local Community Heroes (CH) across the Philippines. We provide tournament listings, capacity tracking, and direct registration links.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>3. Tournament Participation &amp; Registration</h2>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>
                <strong>Eligibility:</strong> Tournaments are open to eligible community teams subject to individual tournament rules established by each Community Hero.
              </li>
              <li>
                <strong>Capacity:</strong> Each tournament slot (typically 16 teams) is allocated on a first-come, first-served basis as confirmed by the respective organizer.
              </li>
              <li>
                <strong>Third-Party Forms:</strong> Official registration forms are managed through Google Forms and organizer spreadsheets. We are not responsible for errors made during team registration on external forms.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>4. Code of Conduct</h2>
            <p>All players, teams, and tournament administrators must observe:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Respectful and sportsmanship-driven conduct towards opponents and organizers.</li>
              <li>Zero tolerance for cheating, map hacking, unauthorized third-party scripts, or account sharing.</li>
              <li>Compliance with the official Moonton / MLBB terms of service and community esports rules.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>5. Intellectual Property &amp; Disclaimer</h2>
            <p>
              Mobile Legends: Bang Bang, its logos, and in-game assets are trademarks of Moonton Games.
              Community Heroes Philippines is an authorized grassroots tournament initiative organized for community esports development.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>6. Modifications to the Service</h2>
            <p>
              We reserve the right to update, modify, or temporarily suspend directory features or tournament listings at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>7. Contact Information</h2>
            <p>
              For inquiries regarding tournament rules or terms, reach out to our organizers:
              <br />
              <strong style={{ color: "#f8fafc" }}>Email:</strong>{" "}
              <a href="mailto:lester.chquezonprovince@gmail.com" style={{ color: "#facc15" }}>
                lester.chquezonprovince@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
