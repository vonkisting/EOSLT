"use client";

import { useId, useState, type ReactNode } from "react";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsCollapsibleCardProps = {
  title: string;
  /** Merged onto the default card surface classes (e.g. connected glow). */
  className?: string;
  defaultOpen?: boolean;
  /** Controlled open state (use with `onOpenChange`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shown before the chevron (e.g. status pill). */
  headerExtra?: ReactNode;
  /** Accessible name fragment for expand/collapse, e.g. "OBS connection". */
  collapseLabel?: string;
  /** When false, omit the rule between the title row and body (default true). */
  bodyTopDivider?: boolean;
  children: ReactNode;
};

const CARD_BASE =
  "w-full rounded-xl border border-white/10 bg-[#2A204A]/35 p-4 shadow-lg backdrop-blur-sm";

/**
 * Stream dashboard card: fixed title row with optional trailing slot and chevron; separator and body collapse together.
 */
export function ObsCollapsibleCard({
  title,
  className = "",
  defaultOpen = true,
  open: openControlled,
  onOpenChange,
  headerExtra,
  collapseLabel,
  bodyTopDivider = true,
  children,
}: ObsCollapsibleCardProps) {
  const uid = useId().replace(/:/g, "");
  const headingId = `obs-stream-card-${uid}-title`;
  const panelId = `obs-stream-card-${uid}-body`;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : internalOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const displayTitle = labelTitleCase(title);
  const a11yName = labelTitleCase(collapseLabel ?? title);

  return (
    <section
      className={`${CARD_BASE} ${className} ${open ? "" : "flex min-h-[4.75rem] flex-col justify-center"}`.trim()}
      aria-labelledby={headingId}
    >
      <div className="w-full">
        <div className={`flex items-center gap-3 ${open ? "pb-1.5" : ""}`}>
          <h2 id={headingId} className="text-sm font-semibold text-blue-300">
            {displayTitle}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? `Collapse ${a11yName}` : `Expand ${a11yName}`}
            >
              <svg
                className={`h-5 w-5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        <div id={panelId} className={open ? "space-y-4 pt-3" : "hidden"}>
          {bodyTopDivider ? (
            <div className="border-b border-white/10" role="presentation" />
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
