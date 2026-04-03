import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OverlayViewportShell } from "@/components/stream/OverlayViewportShell";

export const metadata: Metadata = {
  title: "Stream overlay | EOSLT",
  robots: { index: false, follow: false },
};

/**
 * OBS browser sources: fill the embedded viewport (CEF); avoid `position:fixed` without a sized body chain.
 */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return <OverlayViewportShell>{children}</OverlayViewportShell>;
}
