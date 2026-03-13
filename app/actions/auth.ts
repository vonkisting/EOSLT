"use server";

import { signIn, signOut } from "@/auth";
import { registerUser } from "@/lib/auth-db";

/**
 * Server action to sign out the current user.
 */
export async function signOutAction() {
  await signOut();
}

const DEFAULT_CALLBACK = "/dashboard";

/**
 * Register a new user with email and password, then sign in.
 * Throws if email exists or Convex is not set up.
 */
export async function registerAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");
  if (typeof email !== "string" || typeof password !== "string") {
    throw new Error("Email and password required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  await registerUser(email, password);
  await signIn("credentials", {
    email,
    password,
    callbackUrl: typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : DEFAULT_CALLBACK,
  });
}

/**
 * Sign in with email and password (Credentials provider).
 * Returns { error } so the modal can show a message instead of redirecting on failure.
 */
export async function signInWithCredentialsAction(
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password required" };
  }
  const { verifyCredentials } = await import("@/lib/auth-db");
  const user = await verifyCredentials(email, password);
  if (!user) {
    return { error: "Invalid email or password" };
  }
  await signIn("credentials", {
    email,
    password,
    callbackUrl: typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : DEFAULT_CALLBACK,
  });
  return {};
}

/**
 * Sign in with Google (redirect). Use in a form with POST.
 */
export async function signInWithGoogleAction(formData?: FormData) {
  const cb = formData?.get("callbackUrl");
  const url =
    typeof cb === "string" && cb.startsWith("/") ? cb : DEFAULT_CALLBACK;
  await signIn("google", {
    callbackUrl: url,
  });
}
