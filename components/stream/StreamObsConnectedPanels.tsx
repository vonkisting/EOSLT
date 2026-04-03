"use client";

import { useCallback, useMemo } from "react";
import { ObsAudioPanel, type AudioChannel } from "@/components/stream/ObsAudioPanel";
import { ObsScenesPanel } from "@/components/stream/ObsScenesPanel";
import { ObsScoreboardPanel, type ScoreboardState } from "@/components/stream/ObsScoreboardPanel";
import {
  ObsTournamentSettingsPanel,
  type TournamentSettingsState,
} from "@/components/stream/ObsTournamentSettingsPanel";
import { tournamentPlayerDisplayNames } from "@/components/stream/tournamentSettingsDefaults";
import { ObsSoundboardPanel, type SoundboardEffect } from "@/components/stream/ObsSoundboardPanel";
import { ObsSourcesPanel, type SourceToggle } from "@/components/stream/ObsSourcesPanel";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { useObsScenes } from "@/components/stream/useObsScenes";
import { useObsRealtimeSync } from "@/components/stream/useObsRealtimeSync";

type StreamObsConnectedPanelsProps = {
  connectionName: string;
  soundboardEffects: SoundboardEffect[];
  obsCredentials: ObsCredentials;
  activeScene: string | null;
  setActiveScene: (scene: string | null) => void;
  lastSfx: string | null;
  onTriggerSfx: (soundId: string) => void;
  sources: SourceToggle[];
  onToggleSource: (item: SourceToggle) => void | Promise<void>;
  sourcesLoading: boolean;
  sourcesError: string | null;
  onRefreshSources: () => void;
  togglingKey: string | null;
  audioChannels: AudioChannel[];
  audioLoading: boolean;
  audioError: string | null;
  onRefreshAudio: () => void;
  onAudioVolumeChange: (id: string, volume: number) => void;
  onAudioMute: (id: string, nextMuted: boolean) => void;
  scoreboard: ScoreboardState;
  onScoreboardChange: (next: ScoreboardState) => void;
  tournamentSettings: TournamentSettingsState;
  onTournamentSettingsChange: (next: TournamentSettingsState) => void;
  onTournamentPersistRequest: () => void | Promise<void>;
};

export function StreamObsConnectedPanels({
  connectionName,
  soundboardEffects,
  obsCredentials,
  activeScene,
  setActiveScene,
  lastSfx,
  onTriggerSfx,
  sources,
  onToggleSource,
  sourcesLoading,
  sourcesError,
  onRefreshSources,
  togglingKey,
  audioChannels,
  audioLoading,
  audioError,
  onRefreshAudio,
  onAudioVolumeChange,
  onAudioMute,
  scoreboard,
  onScoreboardChange,
  tournamentSettings,
  onTournamentSettingsChange,
  onTournamentPersistRequest,
}: StreamObsConnectedPanelsProps) {
  const {
    scenes,
    loading: scenesLoading,
    error: scenesError,
    refetch: refetchScenes,
    selectScene,
    switchingScene,
  } = useObsScenes(obsCredentials, true, setActiveScene);

  const refetchObsPanels = useCallback(() => {
    void refetchScenes();
    onRefreshSources();
    onRefreshAudio();
  }, [refetchScenes, onRefreshSources, onRefreshAudio]);

  useObsRealtimeSync(obsCredentials, true, refetchObsPanels);

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
          onSelectScene={(name) => void selectScene(name)}
          loading={scenesLoading}
          error={scenesError}
          switchingScene={switchingScene}
        />
        <ObsSoundboardPanel
          sfxCueEnabled={connectionName.trim().length > 0}
          effects={soundboardEffects}
          lastTriggered={lastSfx}
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
        <ObsScoreboardPanel
          value={scoreboard}
          onChange={onScoreboardChange}
          tournamentPlayerNames={tournamentPlayerNames}
          tournamentSettings={tournamentSettings}
        />
      </div>
    </div>
  );
}
