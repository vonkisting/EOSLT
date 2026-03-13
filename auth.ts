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
});
