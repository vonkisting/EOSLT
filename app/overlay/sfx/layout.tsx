import type { ReactNode } from "react";

/**
 * SFX listener page: fill OBS browser source; small sources stay usable without forcing 100vh scroll.
 */
export default function OverlaySfxLayout({ children }: { children: ReactNode }) {
  return <div className="box-border h-full min-h-0 w-full bg-black text-slate-400">{children}</div>;
}
