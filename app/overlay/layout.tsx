import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Stream overlay | EOSLT",
  robots: { index: false, follow: false },
};

/**
 * Full-viewport shell for OBS browser sources (hides site chrome visually).
 * Child routes add their own background (e.g. SFX uses black; scoreboard is transparent).
 */
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-[200]">{children}</div>;
}
