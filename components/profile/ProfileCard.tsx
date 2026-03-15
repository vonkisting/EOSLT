"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import type { Session } from "next-auth";
import { api } from "@/convex/_generated/api";

type ProfileCardProps = {
  user: NonNullable<Session["user"]>;
};

/**
 * Profile card content: avatar, name, email, PoolHub player (with Unlink when linked), and link warning when not linked.
 */
export function ProfileCard({ user }: ProfileCardProps) {
  const convexUser = useQuery(
    api.users.getByEmail,
    user.email ? { email: user.email } : "skip"
  );
  const setPoolhubPlayerName = useMutation(api.users.setPoolhubPlayerName);
  const [unlinking, setUnlinking] = useState(false);

  const isLinked = Boolean(convexUser?.poolhubPlayerName);
  const linkedName = convexUser?.poolhubPlayerName?.trim() ?? "";

  const handleUnlink = async () => {
    if (!user.email || !linkedName) return;
    setUnlinking(true);
    try {
      await setPoolhubPlayerName({ email: user.email, poolhubPlayerName: "" });
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <>
      {user.image && (
        <img
          src={user.image}
          alt=""
          className="h-16 w-16 rounded-full ring-2 ring-blue-400/30"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200/70">
            Name
          </p>
          <p className="mt-1 text-foreground">{user.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200/70">
            Email
          </p>
          <p className="mt-1 text-foreground">{user.email ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200/70">
            PoolHub Player Name
          </p>
          <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-foreground">
            <span>{linkedName || "—"}</span>
            {isLinked && (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={unlinking}
                className="rounded bg-gradient-to-r from-red-700 to-red-500 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:from-red-600 hover:to-red-400 disabled:opacity-50"
              >
                {unlinking ? "Unlinking…" : "Unlink"}
              </button>
            )}
          </p>
        </div>
      </div>

      {!isLinked && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-4 py-3">
          <p className="text-sm text-amber-200/90">
            You must link your account to your player name in PoolHub to be able
            to score a match.
          </p>
          <Link
            href="/profile/link"
            className="mt-3 inline-flex items-center justify-center rounded-lg border-2 border-blue-400 bg-gradient-to-r from-blue-600 to-blue-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0c1220]"
          >
            Link Now
          </Link>
        </div>
      )}
    </>
  );
}
