import { auth } from "@/auth";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { canAccessDashboard } from "@/lib/dashboard-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Protected dashboard page. Only the allowed email can access; others are redirected.
 * Unauthenticated users are sent to sign-in.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/dashboard");
  }
  if (!canAccessDashboard(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="p-[25px]">
      <DashboardContent />
    </div>
  );
}
