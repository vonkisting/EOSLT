"use client";

import { useMemo } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { ScoreboardOverlayView } from "@/components/stream/ScoreboardOverlayView";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import type { ScoreboardState } from "@/components/stream/streamObsFormDefaults";
import { selectOptionsFullPool } from "@/lib/dropdownOptions";
import { labelTitleCase } from "@/lib/labelTitleCase";

export type { ScoreboardState };

const selectClassName =
  "mt-1 w-full cursor-pointer rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40";

function normalizeSlotName(s: string): string {
  return s.trim().toLowerCase();
}

/** True when both are non-empty and equal ignoring case. */
function playerNamesMatch(a: string, b: string): boolean {
  const x = normalizeSlotName(a);
  const y = normalizeSlotName(b);
  return x.length > 0 && x === y;
}

function sortPlayerNamesAlphabetically(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}


type ObsScoreboardPanelProps = {
  value: ScoreboardState;
  onChange: (next: ScoreboardState) => void;
  /** Player names from Tournament Settings (live while connected). */
  tournamentPlayerNames: string[];
};

/**
 * Scoreboard overlay: player slots use selects bound to the tournament player list.
 */
export function ObsScoreboardPanel({
  value,
  onChange,
  tournamentPlayerNames,
}: ObsScoreboardPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.scoreboard);

  const sortedPool = useMemo(
    () => sortPlayerNamesAlphabetically(tournamentPlayerNames),
    [tournamentPlayerNames]
  );

  const homeOptions = useMemo(
    () => selectOptionsFullPool(sortedPool, value.homeName),
    [sortedPool, value.homeName]
  );
  const awayOptions = useMemo(
    () => selectOptionsFullPool(sortedPool, value.awayName),
    [sortedPool, value.awayName]
  );

  const setHomeName = (homeName: string) => {
    onChange({
      ...value,
      homeName,
      awayName: playerNamesMatch(homeName, value.awayName) ? "" : value.awayName,
    });
  };

  const setAwayName = (awayName: string) => {
    onChange({
      ...value,
      awayName,
      homeName: playerNamesMatch(awayName, value.homeName) ? "" : value.homeName,
    });
  };

  return (
    <ObsCollapsibleCard
      title="Scoreboard Overlay"
      collapseLabel="Scoreboard Overlay"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-400">
          {labelTitleCase("player 1")}
          <select
            className={selectClassName}
            value={value.homeName}
            onChange={(e) => setHomeName(e.target.value)}
            aria-label={labelTitleCase("player 1")}
          >
            <option value="">{labelTitleCase("select player")}</option>
            {homeOptions.map((name, i) => (
              <option key={`h-${name}-${i}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-400">
          {labelTitleCase("player 2")}
          <select
            className={selectClassName}
            value={value.awayName}
            onChange={(e) => setAwayName(e.target.value)}
            aria-label={labelTitleCase("player 2")}
          >
            <option value="">{labelTitleCase("select player")}</option>
            {awayOptions.map((name, i) => (
              <option key={`a-${name}-${i}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mx-auto w-full max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3">
        <p className="text-[10px] font-semibold text-slate-500">
          {labelTitleCase("scoreboard preview")}
        </p>
        <ScoreboardOverlayView value={value} variant="dashboard" />
      </div>
    </ObsCollapsibleCard>
  );
}
