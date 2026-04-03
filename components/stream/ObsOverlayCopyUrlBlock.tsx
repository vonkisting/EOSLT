"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsOverlayCopyUrlBlockProps = {
  /** Optional section label above the URL (omit for a minimal block). */
  title?: string;
  url: string | null;
  /** When true and url is null, show “generating” copy. */
  showPendingPlaceholder: boolean;
  /** Rendered inside the same card below the URL row (e.g. Import to OBS Scene). */
  footer?: ReactNode;
  /** Omit title, URL text, and Copy button (actions-only card). */
  hideUrlAndCopy?: boolean;
};

/**
 * Card for OBS overlay URL (optional copy) and/or footer actions.
 */
export function ObsOverlayCopyUrlBlock({
  title,
  url,
  showPendingPlaceholder,
  footer,
  hideUrlAndCopy = false,
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

  const showUrlSection =
    !hideUrlAndCopy && (Boolean(title) || Boolean(url) || (showPendingPlaceholder && !url));
  const showPendingOnly = hideUrlAndCopy && showPendingPlaceholder && !url;

  if (!url && !showPendingPlaceholder && !footer) return null;

  const footerSep =
    (showUrlSection || showPendingOnly) && footer
      ? "mt-3 space-y-2 border-t border-white/5 pt-3"
      : "space-y-2";

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
      {showUrlSection ? (
        <>
          {title ? (
            <p className="text-[10px] font-semibold text-slate-500">{labelTitleCase(title)}</p>
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
            <p className="mt-1 text-xs text-slate-500">
              Generating overlay link… save profile or wait a moment.
            </p>
          )}
        </>
      ) : null}
      {showPendingOnly ? (
        <p className="text-xs text-slate-500">
          Generating overlay link… save profile or wait a moment.
        </p>
      ) : null}
      {footer ? <div className={footerSep}>{footer}</div> : null}
    </div>
  );
}
