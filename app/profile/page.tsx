import { auth } from "@/auth";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Protected profile page. Redirects unauthenticated users to sign-in.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/profile");
  }

  return (
    <div className="mx-auto min-w-[500px] max-w-[50%] p-[25px]">
      <div className="overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <div className="rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-5">
          <h1 className="text-xl font-semibold tracking-tight text-blue-100">
            Profile
          </h1>
        </div>
        {session?.user && (
          <div className="flex flex-col gap-6 rounded-b-xl border-t border-[var(--surface-border)] bg-gradient-to-br from-[#0c1220] via-[#0e1525] to-[#0c1220] p-6">
            <ProfileCard user={session.user} />
          </div>
        )}
      </div>
    </div>
  );
}
