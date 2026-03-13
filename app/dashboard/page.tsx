import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Protected dashboard page. Redirects unauthenticated users to sign-in.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        This page is protected. Only signed-in users can see it.
      </p>
      {session?.user && (
        <p className="text-zinc-600 dark:text-zinc-400">
          Logged in as <strong>{session.user.email ?? session.user.name}</strong>.
        </p>
      )}
    </div>
  );
}
