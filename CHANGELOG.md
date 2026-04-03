# Changelog

## [Unreleased]

### Changed

- Stream OBS: overlay Export/copy URLs prefer a server-derived origin (`getStreamRequestOverlayOrigin`) so localhost dashboards still wire LAN IPs the OBS PC can reach; `NEXT_PUBLIC_STREAM_OVERLAY_ORIGIN` still overrides. The OBS WebSocket host is only for remote control.
- Stream OBS dashboard: scenes, cameras/sources, and audio panels refresh automatically via a browser-side OBS WebSocket listener (debounced); manual refresh buttons removed. Sound effects list still comes from `public/stream-sfx/` at page load—reload the page after adding MP3s.
- Scoreboard overlay and dashboard preview: flex scorecard with two player columns, VS pill, frosted dark container, cyan glow scores — styled to match the provided OBS HTML/CSS (Segoe UI; compact scale in dashboard preview).

### Added

- Next.js 16 project with TypeScript, App Router, and Turbopack.
- Tailwind CSS 4 with theme variables in `app/globals.css`.
- Auth.js v5 (next-auth@beta) with Google OAuth:
  - `auth.ts` with `authorized` callback for route protection.
  - Route handler at `app/api/auth/[...nextauth]/route.ts`.
  - Server action `signOutAction` in `app/actions/auth.ts`.
- Middleware for auth: protects `/dashboard` and `/profile`; redirects unauthenticated users to sign-in.
- Convex setup: schema in `convex/schema.ts`, `ConvexProvider` in `components/providers.tsx` (mounted only when `NEXT_PUBLIC_CONVEX_URL` is set).
- Basic layout: `components/header.tsx` with nav and sign in/out; root layout with `Providers` and main content area.
- Public home page; protected Dashboard and Profile pages.
- Environment variable template `.env.example` and docs in `README.md`, `convex/README.md`, and `AGENTS.md`.
- `UxStyle.md` and `AGENTS.md` for project conventions.
