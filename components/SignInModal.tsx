"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  registerAction,
  signInWithCredentialsAction,
  signInWithGoogleAction,
} from "@/app/actions/auth";

/** After sign-in, land on auth/landing (redirects to Profile or Dashboard by email). */
const CALLBACK_URL = "/auth/landing";

/**
 * Sign-in modal: Google + email/password (sign in or register).
 * Trigger button opens the modal; auth happens via server actions.
 */
export function SignInModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [error, setError] = useState<string | null>(null);

  async function handleCredentials(formData: FormData) {
    setError(null);
    try {
      if (mode === "register") {
        const password = formData.get("password");
        const confirm = formData.get("confirmPassword");
        if (password !== confirm) {
          setError("Passwords do not match");
          return;
        }
        await registerAction(formData);
        setOpen(false);
        router.push("/profile");
      } else {
        const result = await signInWithCredentialsAction(formData);
        if (result?.error) {
          setError(result.error);
        } else {
          setOpen(false);
          router.push("/auth/landing");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setMode("signin");
        }}
        className="rounded-lg border border-white/30 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
      >
        Sign in
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sign in">
        <div className="flex flex-col gap-4">
          <form action={signInWithGoogleAction} className="flex flex-col gap-3">
            <input type="hidden" name="callbackUrl" value={CALLBACK_URL} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <GoogleIcon />
              Sign in with Google
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-[#2A204A] px-2 text-slate-400">
                or sign in with email
              </span>
            </div>
          </div>

          <form
            action={(fd) => handleCredentials(fd)}
            className="flex flex-col gap-3"
          >
            <input
              type="hidden"
              name="callbackUrl"
              value={mode === "register" ? "/profile" : CALLBACK_URL}
            />
            {mode === "register" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-slate-300"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="text"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                placeholder="Email or username"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                placeholder={mode === "register" ? "At least 8 characters" : ""}
              />
            </div>
            {mode === "register" && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm font-medium text-slate-300"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                  placeholder="Repeat password"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-purple-700 to-purple-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition-opacity hover:opacity-95"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-medium text-white underline hover:text-slate-200 transition-colors"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="font-medium text-white underline hover:text-slate-200 transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </Modal>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
