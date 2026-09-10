import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="error-page">
      <span className="eyebrow">404 / OUT OF BOUNDS</span>
      <h1>
        Let’s get you back
        <br />
        in the game.
      </h1>
      <p>This page doesn’t exist. Your next tournament is waiting.</p>
      <Link className="button primary" href="/">
        Explore tournaments →
      </Link>
    </main>
  );
}
