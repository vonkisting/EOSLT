import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Header } from "@/components/header";
import { EOSLT_PATHNAME_HEADER } from "@/lib/eoslt-request-headers";

/**
 * Site header + main padding for normal pages; bare children for `/overlay/*` (OBS browser sources).
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const h = await headers();
  const pathname = h.get(EOSLT_PATHNAME_HEADER) ?? "";
  const isOverlay = pathname.startsWith("/overlay");

  if (isOverlay) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="min-h-0 flex-1 pt-14">{children}</main>
    </div>
  );
}
