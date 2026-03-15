import { auth } from "@/auth";
import { canAccessDashboard } from "@/lib/dashboard-access";
import { ensureUserInConvex, getConvexUserByEmail } from "@/lib/auth-db";
import { redirect } from "next/navigation";

/**
 * Post-sign-in landing:
 * - kjkisting@gmail.com (case-insensitive) → Dashboard
 * - No PoolHub player linked → Profile
 * - PoolHub player linked → Home
 * No session → Home.
 */
export default async function AuthLandingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const email = session.user.email?.toLowerCase().trim();
  await ensureUserInConvex(
    session.user.email ?? undefined,
    session.user.name ?? undefined,
    session.user.image ?? undefined
  );
  if (!email) {
    redirect("/profile");
  }
  if (canAccessDashboard(email)) {
    redirect("/dashboard");
  }
  let hasPoolHubLink = false;
  try {
    const convexUser = await getConvexUserByEmail(email);
    hasPoolHubLink = Boolean(convexUser?.poolhubPlayerName?.trim());
  } catch {
    // Convex unavailable or lookup failed → treat as no link, send to Profile
  }
  if (hasPoolHubLink) {
    redirect("/");
  }
  redirect("/profile");
}
