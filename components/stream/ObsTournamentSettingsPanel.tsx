"use client";

import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import { type TournamentSettingsState } from "@/components/stream/tournamentSettingsDefaults";
import { labelTitleCase } from "@/lib/labelTitleCase";

export type { TournamentSettingsState };

type ObsTournamentSettingsPanelProps = {
  value: TournamentSettingsState;
  onChange: (next: TournamentSettingsState) => void;
  /** Persist tournament fields to Convex after the user leaves a field (avoids save-on-type focus loss). */
  onPersistRequest?: () => void | Promise<void>;
};

/**
 * Tournament name; player list lives in the Tournament Results collapsible (see {@link ObsTournamentPlayerListCard}).
 */
export function ObsTournamentSettingsPanel({
  value,
  onChange,
  onPersistRequest,
}: ObsTournamentSettingsPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.tournamentSettings);

  const set = (patch: Partial<TournamentSettingsState>) => onChange({ ...value, ...patch });

  return (
    <ObsCollapsibleCard
      title="Tournament Settings"
      collapseLabel="Tournament Settings"
      open={open}
      onOpenChange={setOpen}
    >
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
    </ObsCollapsibleCard>
  );
}
