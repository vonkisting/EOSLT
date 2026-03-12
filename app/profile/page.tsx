import { auth } from "@/auth";

/**
 * Protected profile page. Middleware redirects unauthenticated users to sign-in.
 */
export default async function ProfilePage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Profile
      </h1>
      {session?.user && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {session.user.image && (
            <img
              src={session.user.image}
              alt=""
              className="mb-2 h-12 w-12 rounded-full"
            />
          )}
          <p className="text-zinc-700 dark:text-zinc-300">
            <strong>Name:</strong> {session.user.name ?? "—"}
          </p>
          <p className="text-zinc-700 dark:text-zinc-300">
            <strong>Email:</strong> {session.user.email ?? "—"}
          </p>
        </div>
      )}
    </div>
  );
}
