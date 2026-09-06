"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="error-page">
      <span className="eyebrow">A QUICK TIMEOUT</span>
      <h1>We hit a little lag.</h1>
      <p>Something went wrong loading the directory. Please try again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
