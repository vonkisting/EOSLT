# Convex backend

- **Dev:** Run `bunx convex dev` to link this app to a Convex project (or create one). This generates `_generated/` and adds `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.
- **Prod:** Run `bunx convex deploy` to deploy to production. Use the production deployment URL in your production env (e.g. Vercel) as `NEXT_PUBLIC_CONVEX_URL`.

**Email/password auth:** Registration and sign-in with email use the `users` table (`convex/users.ts`). Run `bunx convex dev` so the real `_generated` API is created; until then, only Google sign-in works.

Add queries, mutations, and actions in this folder. See [Convex docs](https://docs.convex.dev).
