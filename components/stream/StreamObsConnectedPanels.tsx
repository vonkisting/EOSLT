"use client";

import { useMemo, type RefObject } from "react";
import { ObsAudioPanel, type AudioChannel } from "@/components/stream/ObsAudioPanel";
import { ObsScenesPanel } from "@/components/stream/ObsScenesPanel";
import { ObsScoreboardPanel, type ScoreboardState } from "@/components/stream/ObsScoreboardPanel";
import {
  ObsTournamentResultsPanel,
  type TournamentSettingsState,
} from "@/components/stream/ObsTournamentResultsPanel";
import { ObsTournamentSettingsPanel } from "@/components/stream/ObsTournamentSettingsPanel";
import { tournamentPlayerDisplayNames } from "@/components/stream/tournamentSettingsDefaults";
import { ObsSoundboardPanel, type SoundboardEffect } from "@/components/stream/ObsSoundboardPanel";
import { ObsSourcesPanel, type SourceToggle } from "@/components/stream/ObsSourcesPanel";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { useObsRealtimeSync } from "@/components/stream/useObsRealtimeSync";

type StreamObsConnectedPanelsProps = {
  connectionName: string;
  soundboardEffects: SoundboardEffect[];
  obsCredentials: ObsCredentials;
  activeScene: string | null;
  scenes: string[];
  scenesLoading: boolean;
  scenesError: string | null;
  onSelectScene: (name: string) => void;
  switchingScene: string | null;
  onTriggerSfx: (soundId: string) => void;
  sources: SourceToggle[];
  onToggleSource: (item: SourceToggle) => void | Promise<void>;
  sourcesLoading: boolean;
  sourcesError: string | null;
  /** One batched refresh (single OBS WebSocket) for scenes, sources, and audio lists. */
  onRefreshObsPanels: () => void;
  togglingKey: string | null;
  audioChannels: AudioChannel[];
  audioLoading: boolean;
  audioError: string | null;
  onAudioVolumeChange: (id: string, volume: number) => void;
  onAudioMute: (id: string, nextMuted: boolean) => void;
  scoreboard: ScoreboardState;
  onScoreboardChange: (next: ScoreboardState) => void;
  tournamentSettings: TournamentSettingsState;
  onTournamentSettingsChange: (next: TournamentSettingsState) => void;
  onTournamentPersistRequest: () => void | Promise<void>;
  resultsPreviewOuterRef?: RefObject<HTMLDivElement | null>;
};

export function StreamObsConnectedPanels({
  connectionName,
  soundboardEffects,
  obsCredentials,
  activeScene,
  scenes,
  scenesLoading,
  scenesError,
  onSelectScene,
  switchingScene,
  onTriggerSfx,
  sources,
  onToggleSource,
  sourcesLoading,
  sourcesError,
  onRefreshObsPanels,
  togglingKey,
  audioChannels,
  audioLoading,
  audioError,
  onAudioVolumeChange,
  onAudioMute,
  scoreboard,
  onScoreboardChange,
  tournamentSettings,
  onTournamentSettingsChange,
  onTournamentPersistRequest,
  resultsPreviewOuterRef,
}: StreamObsConnectedPanelsProps) {
  useObsRealtimeSync(obsCredentials, true, onRefreshObsPanels);

  const tournamentPlayerNames = useMemo(
    () => tournamentPlayerDisplayNames(tournamentSettings),
    [tournamentSettings]
  );

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <ObsScenesPanel
          connected
          scenes={scenes}
          activeScene={activeScene}
          onSelectScene={onSelectScene}
          loading={scenesLoading}
          error={scenesError}
          switchingScene={switchingScene}
        />
        <ObsSoundboardPanel
          sfxCueEnabled={connectionName.trim().length > 0}
          effects={soundboardEffects}
          onTrigger={onTriggerSfx}
        />
      </div>
      <div className="space-y-6 lg:col-span-7">
        <ObsSourcesPanel
          connected
          sources={sources}
          onToggle={onToggleSource}
          loading={sourcesLoading}
          error={sourcesError}
          togglingKey={togglingKey}
        />
        <ObsAudioPanel
          connected
          channels={audioChannels}
          loading={audioLoading}
          error={audioError}
          onVolumeChange={onAudioVolumeChange}
          onMuteToggle={onAudioMute}
        />
        <ObsTournamentSettingsPanel
          value={tournamentSettings}
          onChange={onTournamentSettingsChange}
          onPersistRequest={onTournamentPersistRequest}
        />
        <ObsTournamentResultsPanel
          settings={tournamentSettings}
          onChange={onTournamentSettingsChange}
          onPersistRequest={onTournamentPersistRequest}
          resultsPreviewOuterRef={resultsPreviewOuterRef}
        />
        <ObsScoreboardPanel
          value={scoreboard}
          onChange={onScoreboardChange}
          tournamentPlayerNames={tournamentPlayerNames}
        />
      </div>
    </div>
  );
}
