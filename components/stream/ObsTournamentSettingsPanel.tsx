"use client";

import { useId } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { ObsTournamentPlayerListRow } from "@/components/stream/ObsTournamentPlayerListRow";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import {
  createEmptyPlayerRow,
  type TournamentSettingsState,
} from "@/components/stream/tournamentSettingsDefaults";
import { labelTitleCase } from "@/lib/labelTitleCase";

export type { TournamentSettingsState };

type ObsTournamentSettingsPanelProps = {
  value: TournamentSettingsState;
  onChange: (next: TournamentSettingsState) => void;
  /** Persist tournament fields to Convex after the user leaves a field (avoids save-on-type focus loss). */
  onPersistRequest?: () => void | Promise<void>;
};

/**
 * Tournament name and expandable player list; persisted with the stream connection profile.
 */
export function ObsTournamentSettingsPanel({
  value,
  onChange,
  onPersistRequest,
}: ObsTournamentSettingsPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.tournamentSettings);
  const { open: playerListOpen, setOpen: setPlayerListOpen } = useObsStreamCardOpen(
    STREAM_OBS_CARD_IDS.tournamentPlayerList
  );
  const playerListUid = useId().replace(/:/g, "");
  const playerListPanelId = `obs-tournament-player-list-${playerListUid}`;

  const set = (patch: Partial<TournamentSettingsState>) => onChange({ ...value, ...patch });

  const updatePlayerName = (id: string, name: string) => {
    set({
      players: value.players.map((p) => (p.id === id ? { ...p, name } : p)),
    });
  };

  const updatePlayerPlacement = (id: string, placement: string) => {
    set({
      players: value.players.map((p) => (p.id === id ? { ...p, placement } : p)),
    });
  };

  const removePlayer = (id: string) => {
    set({ players: value.players.filter((p) => p.id !== id) });
  };

  const addPlayer = () => {
    setPlayerListOpen(true);
    set({ players: [...value.players, createEmptyPlayerRow()] });
  };

  return (
    <ObsCollapsibleCard
      title="Tournament Settings"
      collapseLabel="Tournament Settings"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="flex flex-col gap-4">
        <label className="block text-xs font-medium text-slate-400">
          {labelTitleCase("name")}
          <input
            type="text"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => onPersistRequest?.()}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
            autoComplete="off"
          />
        </label>

        <div className="border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPlayerListOpen(!playerListOpen)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left text-xs font-medium text-slate-400 transition hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
              aria-expanded={playerListOpen}
              aria-controls={playerListPanelId}
              id={`${playerListPanelId}-toggle`}
            >
              <svg
                className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${playerListOpen ? "" : "-rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-[150%] leading-snug">
                {labelTitleCase("player list")} ({value.players.length})
              </span>
            </button>
            <button
              type="button"
              onClick={addPlayer}
              className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 text-lg font-medium leading-none text-slate-100 transition hover:border-purple-400/50 hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
              aria-label={labelTitleCase("add player")}
            >
              +
            </button>
          </div>
          <div
            id={playerListPanelId}
            role="region"
            aria-labelledby={`${playerListPanelId}-toggle`}
            hidden={!playerListOpen}
            className="pt-3"
          >
            <ul className="flex flex-col gap-2" aria-label={labelTitleCase("players")}>
              {value.players.length === 0 ? (
                <li className="text-xs text-slate-500">No players yet. Use + to add a row.</li>
              ) : (
                value.players.map((p) => (
                  <ObsTournamentPlayerListRow
                    key={p.id}
                    player={p}
                    onNameChange={(name) => updatePlayerName(p.id, name)}
                    onPlacementChange={(placement) => updatePlayerPlacement(p.id, placement)}
                    onRemove={() => removePlayer(p.id)}
                    onPersistRequest={onPersistRequest}
                  />
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </ObsCollapsibleCard>
  );
}
