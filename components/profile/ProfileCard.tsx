"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import type { Session } from "next-auth";
import { api } from "@/convex/_generated/api";

type ProfileCardProps = {
  user: NonNullable<Session["user"]>;
};

/**
 * Profile card content: name, email, PoolHub player (with Unlink when linked), link warning when not linked, and View Bracket button.
 */
export function ProfileCard({ user }: ProfileCardProps) {
  const convexUser = useQuery(
    api.users.getByEmail,
    user.email ? { email: user.email } : "skip"
  );
  const setName = useMutation(api.users.setName);
  const setPoolhubPlayerName = useMutation(api.users.setPoolhubPlayerName);
  const [name, setNameValue] = useState(user.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const isLinked = Boolean(convexUser?.poolhubPlayerName);
  const linkedName = convexUser?.poolhubPlayerName?.trim() ?? "";
  const resolvedName = convexUser?.name ?? user.name ?? "";

  useEffect(() => {
    setNameValue(resolvedName);
  }, [resolvedName]);

  const hasNameChanges = name.trim() !== resolvedName.trim();
  const canUpdateName = hasNameChanges && name.trim().length > 0;

  const handleSaveName = async () => {
    if (!user.email || !canUpdateName) return;
    setSavingName(true);
    setNameMessage(null);
    try {
      await setName({ email: user.email, name: name.trim() });
      setNameMessage("Name updated.");
    } catch {
      setNameMessage("Unable to update name right now.");
    } finally {
      setSavingName(false);
    }
  };

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
      <div className="grid gap-4 sm:grid-cols-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200/70">
            Name
          </p>
          <div className="mt-1 space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setNameValue(e.target.value);
                setNameMessage(null);
              }}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-foreground placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName || !canUpdateName}
                className="rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow transition hover:from-blue-600 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingName ? "Updating..." : "Update Name"}
              </button>
              {hasNameChanges && (
                <button
                  type="button"
                  onClick={() => {
                    setNameValue(resolvedName);
                    setNameMessage(null);
                  }}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
              )}
            </div>
            {hasNameChanges && name.trim().length === 0 && (
              <p className="text-sm text-amber-200/90">
                Name cannot be empty.
              </p>
            )}
            {nameMessage && (
              <p className="text-sm text-blue-200/90">{nameMessage}</p>
            )}
          </div>
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

      <Link
        href="/"
        className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-white/20 bg-gradient-to-b from-[#0c1628] via-[#1e3a5f] to-[#0c1628] px-4 py-2.5 text-sm font-medium text-white shadow transition-colors hover:opacity-95"
      >
        View Bracket
      </Link>
    </>
  );
}
