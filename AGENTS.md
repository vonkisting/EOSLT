# EOSLT – Agent guidelines

- Follow the repo root **CLAUDE.md** and this project’s **UxStyle.md**.
- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Auth.js (Google OAuth), Convex.
- **Package manager:** bun.
- **Auth:** Auth.js v5 in `auth.ts`; protected routes via `callbacks.authorized` in middleware. Use `auth()` in server components and `signIn` / `signOut` server actions or client `useSession` as needed.
- **Convex:** Dev/prod via `NEXT_PUBLIC_CONVEX_URL`. Run `bunx convex dev` to link and generate `convex/_generated`.
- **Env:** See `.env.example`; never commit secrets.
