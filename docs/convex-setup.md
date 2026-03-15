# Convex setup (step by step)

This project already has Convex wired (`convex/` folder, schema, and `ConvexProvider` in `components/providers.tsx`). Use these steps to set it up for the first time or on a new machine.

---

## 1. Install / verify Convex

Dependency is already in `package.json`. From the project root:

```bash
bun install
```

(Or `npm install` / `yarn install` if you use those.)

---

## 2. Log in and create or link a project

Run the Convex dev command. It will log you in (browser) and create or link a Convex project:

```bash
bunx convex dev
```

- **First time:** You’ll be asked to sign in (e.g. with GitHub). Convex will create a team and a new project (or you can choose an existing project).
- **Already have a project:** You can link this repo to that project when prompted.
- The command will:
  - Create or update a **development** deployment for this project.
  - Generate `convex/_generated/` and add `CONVEX_DEPLOYMENT` to `.env.local`.
  - Write **`NEXT_PUBLIC_CONVEX_URL`** to `.env.local` (your dev deployment URL).

Leave `bunx convex dev` running while you develop so schema and function changes are pushed to your dev deployment and types stay in sync.

---

## 3. Confirm environment variables

After step 2, `.env.local` should contain:

- `CONVEX_DEPLOYMENT` (e.g. `dev:your-project-123`)
- `NEXT_PUBLIC_CONVEX_URL` (e.g. `https://your-deployment.convex.cloud`)

The app uses `NEXT_PUBLIC_CONVEX_URL` in `components/providers.tsx` to connect the frontend to Convex. If it’s missing, the Convex provider won’t mount and Convex features (e.g. email/password auth in `convex/users.ts`) won’t work.

---

## 4. Deploy to production

When you’re ready to use production:

1. **Deploy the Convex backend:**
   ```bash
   bunx convex deploy
   ```
   Confirm when prompted. This deploys the contents of `convex/` to the **production** deployment of the project you’re linked to.

2. **Use the production URL in production env:**
   - In the [Convex Dashboard](https://dashboard.convex.dev) → your project → **Settings** (or **Deployments**), copy the **production** deployment URL.
   - In your production host (e.g. Vercel), set:
     - **`NEXT_PUBLIC_CONVEX_URL`** = that production URL (not the dev URL).

3. **Optional – deploy from CI:**  
   In your CI pipeline, set **`CONVEX_DEPLOY_KEY`** (from Dashboard → Project Settings → Deploy Key) and run:
   ```bash
   bunx convex deploy
   ```

---

## 5. Summary

| Step              | Command / action |
|-------------------|------------------|
| Install           | `bun install`    |
| Dev (login + sync)| `bunx convex dev` (keep running in dev) |
| Env               | `.env.local` gets `NEXT_PUBLIC_CONVEX_URL` (dev) |
| Production deploy | `bunx convex deploy` |
| Production env    | Set `NEXT_PUBLIC_CONVEX_URL` to **production** URL on your host |

---

# Using only production (no dev deployment)

**Yes, you can use only a production Convex deployment and never use a dev deployment.**

- Every Convex **project** has exactly **one production deployment**. Dev deployments are optional and are created when you run `convex dev` (one per team member).
- To work with **production only**:

1. **Create/link the project once (still via dev command):**  
   Run `bunx convex dev` **once** so Convex can:
   - Log you in and create or link the project.
   - Generate `convex/_generated/` and `.env.local` with `CONVEX_DEPLOYMENT` and a URL.  
   You can then stop `convex dev` and not use a dev deployment again.

2. **Point the app at production:**  
   In `.env.local` (and anywhere else you run the app), set:
   - **`NEXT_PUBLIC_CONVEX_URL`** = your **production** deployment URL (from Dashboard → your project → production deployment URL).  
   Do **not** use the dev deployment URL if you don’t want to use dev.

3. **Push changes by deploying to production:**  
   After editing `convex/` (schema or functions), run:
   ```bash
   bunx convex deploy
   ```
   This updates the **production** deployment only. There is no separate “dev” deployment to update if you don’t run `convex dev`.

**Caveats of production-only:**

- Every change goes straight to production (no isolated dev backend to test against).
- You can’t use the live sync/watch behavior of `convex dev`; you deploy explicitly with `convex deploy`.
- For safer iteration, using a dev deployment (or a separate staging project) is recommended, but it’s not required.

**TL;DR:** Use `bunx convex dev` once to create/link the project and generate files; then set `NEXT_PUBLIC_CONVEX_URL` to the **production** URL and use only `bunx convex deploy` to update the backend. That is a valid “production only” setup.
