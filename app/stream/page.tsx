import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Stream page. Only kjkisting@gmail.com may view; others are redirected home.
 */
export default async function StreamPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/stream");
  }
  if (!canAccessStream(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="w-full px-4 py-6 md:p-[25px]">
      <h1 className="text-xl font-semibold tracking-tight text-blue-100">Stream</h1>
      <p className="mt-2 text-sm text-slate-400">
        Live stream content can be embedded or linked here when ready.
      </p>
    </div>
  );
}
