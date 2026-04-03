import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Stream control",
  description: "OBS stream control dashboard",
};

/**
 * Stream area uses full-width black canvas under the main header.
 */
export default function StreamLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 bg-black">{children}</div>;
}
