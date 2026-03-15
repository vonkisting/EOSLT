# EOSLT

End of Season League Tournament Manager

Next.js 16 app with TypeScript, Auth.js (Google OAuth), Tailwind CSS 4, and Convex.

## Setup

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Environment variables**
   - Copy `.env.example` to `.env.local`.
   - Set `AUTH_SECRET` (e.g. `bunx auth secret`).
   - Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth 2.0 Client). Add redirect URI: `http://localhost:3000/api/auth/callback/google`.
   - For Convex: run `bunx convex dev` and follow prompts to create/link a project. This will add `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.

3. **Run dev**
   ```bash
   bun run dev
   ```
   For Convex backend in dev, run in a second terminal:
   ```bash
   bunx convex dev
   ```

## Scripts

- `bun run dev` – Next.js dev server
- `bun run build` – Production build
- `bun run start` – Start production server
- `bun run lint` – ESLint

## Auth & protected routes

- **Sign in:** Google OAuth via Auth.js; sign-in entry at `/api/auth/signin` or “Sign in” in the header.
- **Protected routes:** `/dashboard` and `/profile` require a signed-in user; middleware redirects others to the sign-in page.

## Convex

- **Dev:** `bunx convex dev` – syncs schema and functions, uses dev deployment URL.
- **Prod:** `bunx convex deploy` – deploys to production. Set `NEXT_PUBLIC_CONVEX_URL` in your production host to the production Convex URL.

See `convex/README.md` for backend details.

## Deploy (Vercel)

- **Build:** Uses `bun run build`. `vercel.json` pins install to `bun install --frozen-lockfile`.
- **Env (Production):** In Vercel project → Settings → Environment Variables, set at least:
  - `AUTH_SECRET` (required for Auth.js)
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (Google OAuth)
  - `NEXT_PUBLIC_CONVEX_URL` (production Convex deployment URL; run `bunx convex deploy` and add the URL).
- Deploy Convex before or with the first deploy: `bunx convex deploy`.
