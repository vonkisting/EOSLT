import { ConvexHttpClient } from "convex/browser";
import bcrypt from "bcrypt";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Verify email/password against Convex users table. Returns user for Auth.js or null.
 * Requires NEXT_PUBLIC_CONVEX_URL and convex dev to be run (_generated/api).
 */
export async function verifyCredentials(
  email: string | undefined,
  password: string | undefined
): Promise<{ id: string; email: string; name?: string } | null> {
  if (!email || !password || !CONVEX_URL) return null;
  try {
    const { api } = await import("@/convex/_generated/api");
    if (!api?.users?.getByEmail) return null; // stub: run `bunx convex dev` for email/password
    const client = new ConvexHttpClient(CONVEX_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await client.query(api.users.getByEmail as any, {
      email: email.toLowerCase().trim(),
    });
    if (!user?.passwordHash) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return {
      id: String(user._id),
      email: user.email,
      name: user.name ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Register a new user (email + password). Hashes password and stores in Convex.
 * Throws if email already exists or Convex is not configured.
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<void> {
  if (!CONVEX_URL) throw new Error("Convex is not configured");
  const { api } = await import("@/convex/_generated/api");
  if (!api?.users?.createUser) throw new Error("Convex not set up. Run: bunx convex dev");
  const client = new ConvexHttpClient(CONVEX_URL);
  const passwordHash = await bcrypt.hash(password, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.mutation(api.users.createUser as any, {
    email: email.toLowerCase().trim(),
    passwordHash,
    name: name || undefined,
  });
}
