"use client";

import { useEffect, useState } from "react";
import { ObsOverlayCopyUrlBlock } from "@/components/stream/ObsOverlayCopyUrlBlock";
import { ObsOverlaySfxUrlRow } from "@/components/stream/ObsOverlaySfxUrlRow";
import {
  DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
  DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
  DEFAULT_SFX_BROWSER_SOURCE_NAME,
} from "@/components/stream/streamObsFormDefaults";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsConnectionOverlayUrlsSectionProps = {
  connected: boolean;
  overlaySfxListenUrl: string | null;
  overlaySfxKeyPending: boolean;
  sfxBrowserSourceName: string;
  onSfxBrowserSourceNameChange: (name: string) => void;
  onWireSfxToObs: () => void | Promise<void>;
  wireSfxPending: boolean;
  wireSfxError: string | null;
  scoreboardOverlayUrl: string | null;
  scoreboardOverlayKeyPending: boolean;
  scoreboardBrowserSourceName: string;
  onScoreboardBrowserSourceNameChange: (name: string) => void;
  onWireScoreboardToObs: () => void | Promise<void>;
  wireScoreboardPending: boolean;
  wireScoreboardError: string | null;
  resultsOverlayUrl: string | null;
  resultsOverlayKeyPending: boolean;
  resultsBrowserSourceName: string;
  onResultsBrowserSourceNameChange: (name: string) => void;
  onWireResultsToObs: () => void | Promise<void>;
  wireResultsPending: boolean;
  wireResultsError: string | null;
};

/**
 * SFX, scoreboard, and tournament results overlay blocks with “Export to OBS Scene” actions.
 */
export function ObsConnectionOverlayUrlsSection({
  connected,
  overlaySfxListenUrl,
  overlaySfxKeyPending,
  sfxBrowserSourceName,
  onSfxBrowserSourceNameChange,
  onWireSfxToObs,
  wireSfxPending,
  wireSfxError,
  scoreboardOverlayUrl,
  scoreboardOverlayKeyPending,
  scoreboardBrowserSourceName,
  onScoreboardBrowserSourceNameChange,
  onWireScoreboardToObs,
  wireScoreboardPending,
  wireScoreboardError,
  resultsOverlayUrl,
  resultsOverlayKeyPending,
  resultsBrowserSourceName,
  onResultsBrowserSourceNameChange,
  onWireResultsToObs,
  wireResultsPending,
  wireResultsError,
}: ObsConnectionOverlayUrlsSectionProps) {
  /** Avoid placeholder SSR/client skew when defaults or bundles differ between server and browser. */
  const [showBrowserSourcePlaceholders, setShowBrowserSourcePlaceholders] = useState(false);
  useEffect(() => {
    setShowBrowserSourcePlaceholders(true);
  }, []);

  const sfxFooter = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-400">
          {labelTitleCase("OBS Audio Source")}
          <input
            type="text"
            value={sfxBrowserSourceName ?? ""}
            onChange={(e) => onSfxBrowserSourceNameChange(e.target.value)}
            placeholder={
              showBrowserSourcePlaceholders ? DEFAULT_SFX_BROWSER_SOURCE_NAME : undefined
            }
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <button
          type="button"
          disabled={wireSfxPending || !connected || !overlaySfxListenUrl}
          title={
            !connected
              ? "Connect to OBS first"
              : !overlaySfxListenUrl
                ? "Save profile and wait for overlay URL"
                : undefined
          }
          onClick={() => void onWireSfxToObs()}
          className="w-full shrink-0 rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 py-2 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:whitespace-nowrap sm:px-5"
        >
          {wireSfxPending ? "Exporting…" : "Export to OBS Scene"}
        </button>
      </div>
      {wireSfxError ? (
        <p className="text-xs text-red-300" role="alert">
          {wireSfxError}
        </p>
      ) : null}
    </>
  );

  const scoreboardFooter = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-400">
          {labelTitleCase("OBS Scoreboard Overlay")}
          <input
            type="text"
            value={scoreboardBrowserSourceName ?? ""}
            onChange={(e) => onScoreboardBrowserSourceNameChange(e.target.value)}
            placeholder={
              showBrowserSourcePlaceholders ? DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME : undefined
            }
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <button
          type="button"
          disabled={wireScoreboardPending || !connected || !scoreboardOverlayUrl}
          title={
            !connected
              ? "Connect to OBS first"
              : !scoreboardOverlayUrl
                ? "Save profile and wait for overlay URL"
                : undefined
          }
          onClick={() => void onWireScoreboardToObs()}
          className="w-full shrink-0 rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 py-2 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:whitespace-nowrap sm:px-5"
        >
          {wireScoreboardPending ? "Exporting…" : "Export to OBS Scene"}
        </button>
      </div>
      {wireScoreboardError ? (
        <p className="text-xs text-red-300" role="alert">
          {wireScoreboardError}
        </p>
      ) : null}
    </>
  );

  const resultsFooter = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-400">
          {labelTitleCase("OBS Browser Results Overlay")}
          <input
            type="text"
            value={resultsBrowserSourceName ?? ""}
            onChange={(e) => onResultsBrowserSourceNameChange(e.target.value)}
            placeholder={
              showBrowserSourcePlaceholders ? DEFAULT_RESULTS_BROWSER_SOURCE_NAME : undefined
            }
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
          />
        </label>
        <button
          type="button"
          disabled={wireResultsPending || !connected || !resultsOverlayUrl}
          title={
            !connected
              ? "Connect to OBS first"
              : !resultsOverlayUrl
                ? "Save profile and wait for overlay URL"
                : undefined
          }
          onClick={() => void onWireResultsToObs()}
          className="w-full shrink-0 rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 py-2 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:whitespace-nowrap sm:px-5"
        >
          {wireResultsPending ? "Exporting…" : "Export to OBS Scene"}
        </button>
      </div>
      {wireResultsError ? (
        <p className="text-xs text-red-300" role="alert">
          {wireResultsError}
        </p>
      ) : null}
    </>
  );

  return (
    <div
      className="space-y-3 border-t border-white/10 pt-4"
      aria-label="OBS overlay and audio source URLs"
    >
      <ObsOverlaySfxUrlRow
        listenUrl={overlaySfxListenUrl}
        pendingKey={overlaySfxKeyPending}
        footer={sfxFooter}
      />
      <ObsOverlayCopyUrlBlock
        url={scoreboardOverlayUrl}
        showPendingPlaceholder={scoreboardOverlayKeyPending && !scoreboardOverlayUrl}
        footer={scoreboardFooter}
        hideUrlAndCopy
        plain
      />
      <ObsOverlayCopyUrlBlock
        url={resultsOverlayUrl}
        showPendingPlaceholder={resultsOverlayKeyPending && !resultsOverlayUrl}
        footer={resultsFooter}
        hideUrlAndCopy
        plain
      />
    </div>
  );
}
