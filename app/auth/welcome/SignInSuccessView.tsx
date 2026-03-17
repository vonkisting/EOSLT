"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";

const AUTO_CLOSE_MS = 3000;

/**
 * Shows a professional success modal for 3 seconds after sign-in, then redirects to the target URL.
 */
export function SignInSuccessView({ next }: { next: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Only show modal after mount to avoid SSR/hydration issues (Modal uses document.body)
  useEffect(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      router.replace(next || "/");
    }, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, next, router]);

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false);
        router.replace(next || "/");
      }}
      title="Signed in"
      hideCloseButton={false}
      closeOnEscape={true}
      closeOnBackdropClick={true}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border border-white/10 shadow-lg shadow-purple-500/10"
          aria-hidden
        >
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-center text-[--foreground] text-base">
          You have been successfully signed in. Taking you to your destination…
        </p>
        <p className="text-sm text-slate-400">
          Redirecting in 3 seconds
        </p>
      </div>
    </Modal>
  );
}
