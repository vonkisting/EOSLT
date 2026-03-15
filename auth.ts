import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyCredentials } from "@/lib/auth-db";

/**
 * Auth.js v5: Google OAuth + Email/Password (Credentials via Convex).
 * Protected routes redirect in page components, not middleware.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return verifyCredentials(
          credentials?.email as string,
          credentials?.password as string
        );
      },
    }),
  ],
  trustHost: true,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    jwt({ token, user, account, profile }) {
      if (user?.email) token.email = user.email;
      if (profile?.email && typeof profile.email === "string") token.email = profile.email;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email as string;
      return session;
    },
    redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url, baseUrl);
        const callbackUrl = parsed.searchParams.get("callbackUrl");
        if (callbackUrl && callbackUrl.startsWith("/")) {
          return new URL(callbackUrl, baseUrl).toString();
        }
        if (url.startsWith("/")) return new URL(url, baseUrl).toString();
        return url;
      } catch {
        return baseUrl;
      }
    },
  },
});
