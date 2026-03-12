# Changelog

## [Unreleased]

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
