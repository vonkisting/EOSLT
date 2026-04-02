"use client";

import { useCallback, useState } from "react";

type ObsOverlayCopyUrlBlockProps = {
  /** Optional section label above the URL (omit for a minimal block). */
  title?: string;
  url: string | null;
  /** When true and url is null, show “generating” copy. */
  showPendingPlaceholder: boolean;
};

/**
 * Copyable URL block for OBS browser sources (shared by SFX + scoreboard).
 */
export function ObsOverlayCopyUrlBlock({
  title,
  url,
  showPendingPlaceholder,
}: ObsOverlayCopyUrlBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [url]);

  if (!url && !showPendingPlaceholder) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      ) : null}
      {url ? (
        <div
          className={
            title
              ? "mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
              : "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
          }
        >
          <code className="min-w-0 flex-1 truncate rounded bg-black/50 px-2 py-1 text-[11px] text-slate-400">
            {url}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-900/35 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Generating overlay link… save profile or wait a moment.</p>
      )}
    </div>
  );
}
