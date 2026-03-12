"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SessionProvider } from "next-auth/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Client providers: Convex (data) and NextAuth SessionProvider (client-side auth state).
 * ConvexProvider is only mounted when NEXT_PUBLIC_CONVEX_URL is set (e.g. after `bunx convex dev`).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {convex ? (
        <ConvexProvider client={convex}>{children}</ConvexProvider>
      ) : (
        children
      )}
    </SessionProvider>
  );
}
