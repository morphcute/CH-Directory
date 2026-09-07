import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Brand, Footer } from "@/features/shared";

export const metadata: Metadata = {
  title: "Privacy Policy | Community Heroes",
  description: "Privacy Policy for the Community Heroes Tournament Directory.",
};

export default function PrivacyPage() {
  return (
    <div>
      <header className="site-header simple-header">
        <div className="header-inner">
          <Brand />
          <Link href="/" className="button outline small">
            <ArrowLeft size={14} /> Back to Directory
          </Link>
        </div>
      </header>

      <main className="legal-main" id="main-content">
        <div className="legal-header-meta">
          <div className="legal-icon-box">
            <Shield size={22} />
          </div>
          <div>
            <span className="eyebrow">LEGAL & TRUST</span>
            <h1 style={{ fontSize: "2rem", margin: 0, color: "#f8fafc" }}>Privacy Policy</h1>
          </div>
        </div>

        <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: 24 }}>
          Last updated: September 7, 2026
        </p>

        <div className="legal-card">
          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px", marginTop: 0 }}>1. Introduction</h2>
            <p>
              Welcome to <strong>Community Heroes Tournament Directory</strong> (&quot;ch-directory.sbs&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
              We are committed to protecting the privacy of players, teams, and tournament organizers who use our directory
              to discover, join, and manage local community tournaments for Mobile Legends: Bang Bang (MLBB).
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>2. Information We Collect</h2>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>
                <strong>Public Tournament Listings:</strong> Community Hero nicknames, regions/areas, Facebook profile links, and registration links.
              </li>
              <li>
                <strong>Registered Team Names:</strong> Team names submitted through organizer registration forms are displayed publicly to show roster capacity and confirmed brackets.
              </li>
              <li>
                <strong>Organizer Google Account Information:</strong> For authorized organizers logging into the admin workspace, we receive your verified Google email address and a temporary OAuth token. We do NOT store passwords.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>3. Use of Google OAuth 2.0 &amp; Sheets API</h2>
            <p>
              Our application uses Google OAuth 2.0 exclusively for organizer authentication and Google Sheets synchronization:
            </p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>
                <strong>Scope Requested:</strong> <code>https://www.googleapis.com/auth/spreadsheets.readonly</code>
              </li>
              <li>
                <strong>Purpose:</strong> Used solely to read tournament response sheets configured by the organizer to count registered teams, verify capacity (e.g. 16/16), and display team rosters.
              </li>
              <li>
                <strong>Data Retention:</strong> We do not store, sell, or transfer your Google data to third parties. We strictly comply with the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#facc15", textDecoration: "underline" }}
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>4. How We Use Information</h2>
            <p>We use the collected information to:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Display verified Community Heroes and upcoming tournament opportunities.</li>
              <li>Provide direct links to official tournament registration forms and organizer Facebook channels.</li>
              <li>Display real-time capacity and registered squad lists so players know when slots are filled.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>5. Data Protection and Security</h2>
            <p>
              We implement industry-standard encryption, HTTPS protocols, and signed HttpOnly cookies to protect session integrity and administrative functions.
            </p>
          </section>

          <section>
            <h2 style={{ color: "#facc15", fontSize: "18px" }}>6. Contact Us</h2>
            <p>
              If you have any questions or requests regarding this Privacy Policy, please contact our administrator at:
              <br />
              <strong style={{ color: "#f8fafc" }}>Email:</strong>{" "}
              <a href="mailto:lester.chquezonprovince@gmail.com" style={{ color: "#facc15" }}>
                lester.chquezonprovince@gmail.com
              </a>
              <br />
              <strong style={{ color: "#f8fafc" }}>Facebook:</strong>{" "}
              <a
                href="https://www.facebook.com/MLBBPHCommunityHeroes"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#facc15" }}
              >
                facebook.com/MLBBPHCommunityHeroes
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
