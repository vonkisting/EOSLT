"use client";

import type { StreamLogoRowUi } from "@/components/stream/streamObsLogoTypes";
import { labelTitleCase } from "@/lib/labelTitleCase";

type ObsConnectionLogoRowProps = {
  logo: StreamLogoRowUi;
  connected: boolean;
  obsReady: boolean;
  inputName: string;
  onInputNameChange: (value: string) => void;
  onWire: () => void;
  onRemove: () => void;
  wiring: boolean;
  wireError: string | null;
};

/**
 * One imported logo: editable OBS source name, wire button, remove.
 */
export function ObsConnectionLogoRow({
  logo,
  connected,
  obsReady,
  inputName,
  onInputNameChange,
  onWire,
  onRemove,
  wiring,
  wireError,
}: ObsConnectionLogoRowProps) {
  return (
    <li className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-xs text-slate-400" title={logo.fileName}>
            {logo.fileName}
          </p>
          <label className="block text-xs font-medium text-slate-400">
            {labelTitleCase("OBS image source name")}
            <input
              type="text"
              value={inputName}
              onChange={(e) => onInputNameChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
            />
          </label>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={wiring || !connected || !logo.url || !obsReady}
            title={
              !connected
                ? "Connect to OBS first"
                : !logo.url
                  ? "Wait for file URL"
                  : undefined
            }
            onClick={() => void onWire()}
            className="rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-purple-900/40 transition hover:from-purple-600 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/60 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {wiring ? "Importing…" : "Import to OBS Scene"}
          </button>
          <button
            type="button"
            onClick={() => void onRemove()}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-red-400/50 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </div>
      {wireError ? (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {wireError}
        </p>
      ) : null}
    </li>
  );
}
