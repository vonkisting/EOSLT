"use client";

import { type RefObject } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { ObsTournamentPlayerListCard } from "@/components/stream/ObsTournamentPlayerListCard";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";
import { TournamentResultsPreviewView } from "@/components/stream/TournamentResultsPreviewView";
import type { TournamentSettingsState } from "@/components/stream/tournamentSettingsDefaults";
import { RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX } from "@/lib/streamObsResultsPreviewDimensions";

export type { TournamentSettingsState };

type ObsTournamentResultsPanelProps = {
  settings: TournamentSettingsState;
  onChange: (next: TournamentSettingsState) => void;
  onPersistRequest?: () => void | Promise<void>;
  /** Border box for OBS results browser source export sizing. */
  resultsPreviewOuterRef?: RefObject<HTMLDivElement | null>;
  className?: string;
};

/**
 * Collapsible “Tournament Results”: player list (left) and results grid preview (right) in the body.
 */
export function ObsTournamentResultsPanel({
  settings,
  onChange,
  onPersistRequest,
  resultsPreviewOuterRef,
  className = "",
}: ObsTournamentResultsPanelProps) {
  const { open, setOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.tournamentResults);

  return (
    <ObsCollapsibleCard
      title="Tournament Results"
      collapseLabel="Tournament Results"
      className={className}
      open={open}
      onOpenChange={setOpen}
      bodyTopDivider={false}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-4">
        <ObsTournamentPlayerListCard
          value={settings}
          onChange={onChange}
          onPersistRequest={onPersistRequest}
        />
        <div
          ref={resultsPreviewOuterRef}
          className="mx-auto box-border w-full max-w-full shrink-0 overflow-x-hidden rounded-lg border border-white/10 bg-black/50 px-3 py-3 text-sm text-slate-200 xl:mx-0"
          style={{
            width: RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX,
            maxWidth: RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX,
          }}
        >
          <TournamentResultsPreviewView settings={settings} />
        </div>
      </div>
    </ObsCollapsibleCard>
  );
}
