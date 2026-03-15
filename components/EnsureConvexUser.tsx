"use client";

import { useMutation } from "convex/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";

/**
 * When the user is signed in (e.g. after Google OAuth), ensure they have a row in Convex.
 * Runs once per session so Google sign-ins that miss the server-side ensure still get created.
 */
export function EnsureConvexUser() {
  const { data: session, status } = useSession();
  const ensureUser = useMutation(api.users.ensureUser);
  const ensuredRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    const email = session.user.email.toLowerCase().trim();
    if (ensuredRef.current === email) return;
    ensuredRef.current = email;
    ensureUser({
      email,
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
    }).catch(() => {
      ensuredRef.current = null;
    });
  }, [status, session?.user?.email, session?.user?.name, session?.user?.image, ensureUser]);

  return null;
}
