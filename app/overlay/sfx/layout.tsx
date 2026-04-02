import type { ReactNode } from "react";

/**
 * SFX listener page: opaque background so dock UI is readable.
 */
export default function OverlaySfxLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-black text-slate-400">{children}</div>;
}
