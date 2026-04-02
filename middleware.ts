import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { EOSLT_PATHNAME_HEADER } from "@/lib/eoslt-request-headers";

/**
 * Exposes the request pathname to the root layout so `/overlay/*` can omit site chrome without a client wrapper.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(EOSLT_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
