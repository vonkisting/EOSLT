import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { SignInModal } from "@/components/SignInModal";

/**
 * App header with brand, nav links, and auth actions.
 * Responsive: mobile menu can be added later per UxStyle.
 */
export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50">
      <div className="flex h-14 w-full items-center justify-between gap-4 border-b border-white/10 bg-[#2A204A]/90 px-4 shadow-lg backdrop-blur-md sm:px-6">
        <Link
          href="/"
          className="font-semibold text-white"
          aria-label="Home"
        >
          EOSLT
        </Link>
        <nav className="flex items-center gap-4" aria-label="Main">
          <Link
            href="/"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Home
          </Link>
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Profile
              </Link>
              <form action={signOutAction} className="inline">
                <button
                  type="submit"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <SignInModal />
          )}
        </nav>
      </div>
    </header>
  );
}
