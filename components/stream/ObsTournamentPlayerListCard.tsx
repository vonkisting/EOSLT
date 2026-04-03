"use client";

import { ObsTournamentPlayerListRow } from "@/components/stream/ObsTournamentPlayerListRow";
import {
  createEmptyPlayerRow,
  type TournamentSettingsState,
} from "@/components/stream/tournamentSettingsDefaults";
import { labelTitleCase } from "@/lib/labelTitleCase";

export type { TournamentSettingsState };

type ObsTournamentPlayerListCardProps = {
  value: TournamentSettingsState;
  onChange: (next: TournamentSettingsState) => void;
  onPersistRequest?: () => void | Promise<void>;
  className?: string;
};

/**
 * Bordered player list block for use inside {@link ObsTournamentResultsPanel} (not a collapsible root).
 */
export function ObsTournamentPlayerListCard({
  value,
  onChange,
  onPersistRequest,
  className = "",
}: ObsTournamentPlayerListCardProps) {
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
    set({ players: [...value.players, createEmptyPlayerRow()] });
  };

  return (
    <section
      className={`flex min-w-0 flex-1 flex-col rounded-lg border border-white/10 bg-black/25 p-3 ${className}`.trim()}
      aria-label={labelTitleCase("player list")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <h3 className="text-xs font-semibold text-blue-300">{labelTitleCase("player list")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-slate-400">{value.players.length}</span>
          <button
            type="button"
            onClick={addPlayer}
            className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 text-lg font-medium leading-none text-slate-100 transition hover:border-purple-400/50 hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            aria-label={labelTitleCase("add player")}
          >
            +
          </button>
        </div>
      </div>
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
    </section>
  );
}
