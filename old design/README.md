# Community Heroes

A redesigned MLBB community tournament directory, built with Next.js 16 App Router, React 19, and TypeScript. The UI uses an ivory and forest-green palette, locally hosted typography, and original fantasy hero artwork.

## Run locally

Requires Node.js 20.9 or later (tested with Node.js 22).

```sh
npm install
npm run dev
```

Open http://localhost:3000. The organizer workspace is at `/admin`.

A private `.env.local` has been generated for this workspace. Use its `ADMIN_PASSWORD` to sign in. Neither the password nor the session secret is shipped to the browser. On another machine, copy `.env.example` to `.env.local` and set a unique password of at least 12 characters and a random `SESSION_SECRET` of at least 32 characters. Restart the server after changing them.

## What is included

- Responsive tournament directory with search, region and availability filters, sorting, grid/list layouts, and incremental loading.
- Community Hero profiles, direct registration links, shareable tournament URLs, downloadable registration QR codes, and saved tournaments persisted on the current browser.
- Keyboard-accessible dialogs, visible focus states, reduced-motion support, mobile navigation, and dedicated loading/error/not-found states.
- Organizer sign-in with signed HttpOnly sessions, server-side write authorization, request-origin checks, and a login attempt throttle.
- Organizer editing, adding listings, visibility controls, JSON export, draft review, and publishing.
- Google Sheets imports, private-sheet Google OAuth, pasted CSV/TSV imports, preview before replacing a draft, and source capacity checks.
- Optional hourly source checks while the organizer workspace remains open. Checks update the draft; publishing is explicit.
- Public pages refresh published directory data every minute. Counts are described as last recorded values, not guaranteed live availability.

## Data and integrations

The included lineup preserves the original project's 19 organizer records and links, with 13 active listings. Its September 2026 data is a starting snapshot. Confirm the actual event schedule, capacity, and registration requirements with organizers. The displayed month is the directory cycle; it is not an invented event date.

Published data is stored atomically in `data/app-state.json`. If an existing file from the original project is present, it is loaded automatically. Set `DATA_DIR` to use a different storage directory.

Google imports expect columns A–G: Active, Area, Full name, Nickname, Teams (for example `10/16`), Registration form, Response sheet. CSV parsing supports quoted commas, escaped quotes, and multiline cells. Facebook URLs are extracted from supplied hyperlinks; missing links are not fabricated.

For private Google Sheets, the existing Firebase project configuration is retained. Its owner must enable Google sign-in and authorize the deployed domain in Firebase. The signed-in Google account must have sheet access. Google OAuth and actual third-party registration availability require these external permissions and were not exercised with a real account during local verification.

Response capacity checks count nonempty rows after the header. Each row must represent one team; remove duplicate or test entries in the source sheet. Failed checks preserve existing counts and show a source-review message. Remote checks only follow supported Google, TinyURL, and Bitly hosts with timeouts and redirect limits.

## Production

```sh
npm run build
npm start
```

Deploy on a Node.js host with HTTPS and a persistent volume mounted at `DATA_DIR`. The file store and login throttle suit a single Node.js instance. Before deploying to ephemeral/serverless infrastructure or multiple instances, replace the file store with a shared database and the in-memory login throttle with a shared rate limiter. Never commit `.env.local` or publish your local test credentials.

Next.js migration follows the official [App Router installation guidance](https://nextjs.org/docs/app/getting-started/installation). Vite and Express are no longer part of the build or runtime.

## Verification

```sh
npm run lint
npm test
npm run build
```

`tests/browser.mjs` runs a browser integration pass against an isolated production server at port 3101 using installed Google Chrome. Start that server with `ADMIN_PASSWORD=local-audit-password-only`, `SESSION_SECRET=local-audit-session-secret-only-2026-09`, and `DATA_DIR` pointing to an isolated directory such as `.audit/data`; then run `node tests/browser.mjs`. These values are for the isolated test process only.

The browser test covers filtering, empty results, saved-state persistence, profiles, QR codes, dialogs, list mode, organizer sign-in/edit/publish, import preview, logout, mobile navigation, layout overflow at 390/768/1024px, and browser runtime errors. It edits only the isolated test directory.

With the same isolated server running, `npm run test:a11y` checks the desktop directory, mobile directory, tournament dialog, organizer sign-in, and organizer workspace with axe-core's WCAG A/AA rules. Automated checks supplement the manual visual and keyboard review; they do not certify full accessibility conformance.

## Project layout

- `src/app`: Next.js routes, metadata, global styles, and API route handlers.
- `src/features`: public portal, organizer workspace, and shared UI.
- `src/server`: persistence, authentication, validation, and safe Google source requests.
- `src/lib/tournaments.ts`: availability, search, and link handling.
- `src/data`: original organizer data.
- `public/images` and `public/fonts`: self-hosted visual assets and font licenses.
- `legacy`: preserved original Vite/Express UI and configuration, excluded from compilation.
- `docs/design-notes.md`: visual direction and hero artwork generation record.

# CH-Directory
