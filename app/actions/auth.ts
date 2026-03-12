"use server";

import { signOut } from "@/auth";

/**
 * Server action to sign out the current user. Use in forms or buttons.
 */
export async function signOutAction() {
  await signOut();
}
