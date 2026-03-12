import { auth } from "@/auth";
import Link from "next/link";

/**
 * Home page: public, with sign-in CTA or welcome for authenticated users.
 */
export default async function HomePage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Welcome to EOSLT
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Next.js 16 with TypeScript, Auth.js (Google OAuth), Tailwind CSS 4, and
        Convex.
      </p>
      {session?.user ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Signed in as <strong>{session.user.email ?? session.user.name}</strong>
          . Visit <Link href="/dashboard" className="underline">Dashboard</Link> or{" "}
          <Link href="/profile" className="underline">Profile</Link>.
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          <Link
            href="/api/auth/signin"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Sign in with Google
          </Link>{" "}
          to access protected routes.
        </p>
      )}
    </div>
  );
}
