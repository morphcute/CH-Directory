"use client";
import Link from "next/link";
import { ArrowUpRight, Crown, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Brand({ logoUrl }: { logoUrl?: string } = {}) {
  return (
    <Link className="brand" href="/" aria-label="CH Directory home">
      <span className="brand-mark">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
        ) : (
          <Crown size={25} strokeWidth={2.3} />
        )}
      </span>
      <span>
        CH DIRECTORY
        <span>
          COMMUNITY HEROES<span className="brand-ph">PH</span>
        </span>
      </span>
    </Link>
  );
}
export function Footer({ logoUrl }: { logoUrl?: string } = {}) {
  return (
    <footer className="footer">
      <Brand logoUrl={logoUrl} />
      <p>Built for the community. Powered by you.</p>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          margin: "4px 0",
        }}
      >
        <Link
          href="/privacy"
          style={{ color: "#facc15", textDecoration: "none" }}
        >
          Privacy Policy
        </Link>
        <span style={{ opacity: 0.35 }}>•</span>
        <Link
          href="/terms"
          style={{ color: "#facc15", textDecoration: "none" }}
        >
          Terms of Service
        </Link>
      </div>
      <a
        href="https://www.facebook.com/MLBBPHCommunityHeroes"
        target="_blank"
        rel="noreferrer"
      >
        Find us on Facebook <ArrowUpRight size={15} />
      </a>
      <span className="footer-note">
        CH Directory — A community tournament directory for MLBB players.
      </span>
    </footer>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === ref.current) closeRef.current();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <span className="eyebrow">COMMUNITY HEROES</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
