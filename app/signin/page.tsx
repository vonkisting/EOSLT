import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

/**
 * Custom sign-in page. Avoids the default Auth.js signin route to prevent redirect loops.
 * User lands here, clicks Google, and is sent to Google OAuth (no GET /api/auth/signin).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/auth/landing");
  }
  const { callbackUrl } = await searchParams;
  const safeCallback = callbackUrl?.startsWith("/") ? callbackUrl : "/auth/landing";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Sign in to EOSLT
      </h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          const cb = formData.get("callbackUrl");
          const url =
            typeof cb === "string" && cb.startsWith("/") ? cb : "/auth/landing";
          await signIn("google", { callbackUrl: url });
        }}
      >
        <input type="hidden" name="callbackUrl" value={safeCallback} />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
