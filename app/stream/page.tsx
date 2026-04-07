import { auth } from "@/auth";
import { StreamObsDashboard } from "@/components/stream/StreamObsDashboard";
import { canAccessStream } from "@/lib/stream-access";
import { listStreamGraphicsBasenames } from "@/lib/list-stream-graphics";
import { listStreamSfxMp3Basenames } from "@/lib/list-stream-sfx-mp3";
import { getStreamOverlayPublicOrigin } from "@/lib/stream-overlay-public-origin";
import { getStreamRequestOverlayOrigin } from "@/lib/stream-request-overlay-origin";
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
  const sfxBasenames = listStreamSfxMp3Basenames(); // all allowed audio extensions in public/stream-sfx/
  const graphicsBasenames = listStreamGraphicsBasenames();
  const overlayRequestOrigin = await getStreamRequestOverlayOrigin();

  return (
    <StreamObsDashboard
      userEmail={email}
      sfxBasenames={sfxBasenames}
      graphicsBasenames={graphicsBasenames}
      overlayPublicOrigin={getStreamOverlayPublicOrigin()}
      overlayRequestOrigin={overlayRequestOrigin}
    />
  );
}
