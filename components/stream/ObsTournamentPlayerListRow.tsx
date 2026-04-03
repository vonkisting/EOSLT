"use client";

import {
  TOURNAMENT_PLAYER_PLACEMENT_OPTIONS,
  type TournamentPlayerRow,
} from "@/components/stream/tournamentSettingsDefaults";
import { labelTitleCase } from "@/lib/labelTitleCase";

const inputClassName =
  "min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40";

const placementSelectClassName =
  "min-w-[10.5rem] max-w-full shrink-0 cursor-pointer rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40";

type ObsTournamentPlayerListRowProps = {
  player: TournamentPlayerRow;
  onNameChange: (name: string) => void;
  onPlacementChange: (placement: string) => void;
  onRemove: () => void;
  onPersistRequest?: () => void | Promise<void>;
};

/**
 * One tournament player row: name, finish-bracket select, remove.
 */
export function ObsTournamentPlayerListRow({
  player,
  onNameChange,
  onPlacementChange,
  onRemove,
  onPersistRequest,
}: ObsTournamentPlayerListRowProps) {
  const placement = player.placement;
  const pool = TOURNAMENT_PLAYER_PLACEMENT_OPTIONS as readonly string[];
  const showLegacyPlacement =
    placement.trim() !== "" && !pool.includes(placement);

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        type="text"
        value={player.name}
        onChange={(e) => onNameChange(e.target.value)}
        onBlur={() => onPersistRequest?.()}
        className={inputClassName}
        placeholder={labelTitleCase("player name")}
        autoComplete="off"
      />
      <select
        value={placement}
        onChange={(e) => onPlacementChange(e.target.value)}
        onBlur={() => onPersistRequest?.()}
        className={placementSelectClassName}
        aria-label={labelTitleCase("placement")}
      >
        <option value="">{labelTitleCase("select placement")}</option>
        {showLegacyPlacement ? (
          <option value={placement}>{placement}</option>
        ) : null}
        {TOURNAMENT_PLAYER_PLACEMENT_OPTIONS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg border border-red-500/55 bg-gradient-to-b from-red-700 to-red-800 px-2.5 py-2 text-xs font-medium text-red-50 shadow-sm transition hover:from-red-600 hover:to-red-700 hover:border-red-400/70 focus:outline-none focus:ring-2 focus:ring-red-400/50 active:from-red-800 active:to-red-900"
        aria-label={labelTitleCase("remove player")}
      >
        Remove
      </button>
    </li>
  );
}
