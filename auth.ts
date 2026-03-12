import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

/**
 * Auth.js v5 configuration with Google OAuth.
 * Protected routes require a valid session; others are public.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/profile");
      if (isProtected && !session?.user) {
        return NextResponse.redirect(new URL("/api/auth/signin", request.url));
      }
      return true;
    },
  },
  pages: {
    signIn: "/api/auth/signin",
  },
});
