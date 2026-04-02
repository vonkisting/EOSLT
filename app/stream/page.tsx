import { auth } from "@/auth";
import { StreamObsDashboard } from "@/components/stream/StreamObsDashboard";
import { canAccessStream } from "@/lib/stream-access";
import { listStreamSfxMp3Basenames } from "@/lib/list-stream-sfx-mp3";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Stream control: OBS dashboard for authenticated, allowlisted users only.
 * Data layer is separate from league Convex; session identifies the operator.
 */
export default async function StreamPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/stream");
  }
  if (!canAccessStream(session.user.email)) {
    redirect("/");
  }

  const email = session.user.email ?? "";
  const name = session.user.name ?? null;
  const sfxBasenames = listStreamSfxMp3Basenames();

  return <StreamObsDashboard userEmail={email} userName={name} sfxBasenames={sfxBasenames} />;
}
