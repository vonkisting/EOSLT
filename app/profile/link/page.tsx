import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LinkPlayerList } from "@/components/profile/LinkPlayerList";

export const dynamic = "force-dynamic";

/**
 * Link account to a PoolHub player name. Lists the same players as the dashboard
 * with a Link button; already-linked players do not show the button.
 */
export default async function ProfileLinkPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/profile/link");
  }

  return (
    <div className="mx-auto min-w-[500px] max-w-[50%] p-[25px]">
      <div className="overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <div className="rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-5">
          <h1 className="text-xl font-semibold tracking-tight text-blue-100">
            Link to PoolHub player
          </h1>
        </div>
        <div className="flex flex-col gap-4 rounded-b-xl border-t border-[var(--surface-border)] bg-gradient-to-br from-[#0c1220] via-[#0e1525] to-[#0c1220] p-6">
          <LinkPlayerList userEmail={session.user.email ?? ""} />
        </div>
      </div>
    </div>
  );
}
