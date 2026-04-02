"use client";

import { ObsAudioPanel, type AudioChannel } from "@/components/stream/ObsAudioPanel";
import { ObsScenesPanel } from "@/components/stream/ObsScenesPanel";
import { ObsScoreboardPanel, type ScoreboardState } from "@/components/stream/ObsScoreboardPanel";
import { ObsSoundboardPanel, type SoundboardEffect } from "@/components/stream/ObsSoundboardPanel";
import { ObsSourcesPanel, type SourceToggle } from "@/components/stream/ObsSourcesPanel";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { useObsScenes } from "@/components/stream/useObsScenes";

type StreamObsConnectedPanelsProps = {
  connectionName: string;
  soundboardEffects: SoundboardEffect[];
  obsCredentials: ObsCredentials;
  activeScene: string | null;
  setActiveScene: (scene: string | null) => void;
  lastSfx: string | null;
  onTriggerSfx: (soundId: string) => void;
  overlaySfxListenUrl: string | null;
  overlaySfxKeyPending: boolean;
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
  scoreboardOverlayUrl: string | null;
  overlayKeyPending: boolean;
  scoreboardBrowserSourceName: string;
  onScoreboardBrowserSourceNameChange: (name: string) => void;
  onWireScoreboardToObs: () => void | Promise<void>;
  wireScoreboardPending: boolean;
  wireScoreboardError: string | null;
  wireScoreboardSuccessAt: string | null;
};

export function StreamObsConnectedPanels({
  connectionName,
  soundboardEffects,
  obsCredentials,
  activeScene,
  setActiveScene,
  lastSfx,
  onTriggerSfx,
  overlaySfxListenUrl,
  overlaySfxKeyPending,
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
  scoreboardOverlayUrl,
  overlayKeyPending,
  scoreboardBrowserSourceName,
  onScoreboardBrowserSourceNameChange,
  onWireScoreboardToObs,
  wireScoreboardPending,
  wireScoreboardError,
  wireScoreboardSuccessAt,
}: StreamObsConnectedPanelsProps) {
  const {
    scenes,
    loading: scenesLoading,
    error: scenesError,
    refetch: refetchScenes,
    selectScene,
    switchingScene,
  } = useObsScenes(obsCredentials, true, setActiveScene);

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
          onRefresh={refetchScenes}
          switchingScene={switchingScene}
        />
        <ObsSoundboardPanel
          sfxCueEnabled={connectionName.trim().length > 0}
          effects={soundboardEffects}
          lastTriggered={lastSfx}
          onTrigger={onTriggerSfx}
          overlaySfxListenUrl={overlaySfxListenUrl}
          overlaySfxKeyPending={overlaySfxKeyPending}
        />
      </div>
      <div className="space-y-6 lg:col-span-7">
        <ObsSourcesPanel
          connected
          sources={sources}
          onToggle={onToggleSource}
          loading={sourcesLoading}
          error={sourcesError}
          onRefresh={onRefreshSources}
          togglingKey={togglingKey}
        />
        <ObsAudioPanel
          connected
          channels={audioChannels}
          loading={audioLoading}
          error={audioError}
          onRefresh={onRefreshAudio}
          onVolumeChange={onAudioVolumeChange}
          onMuteToggle={onAudioMute}
        />
        <ObsScoreboardPanel
          value={scoreboard}
          onChange={onScoreboardChange}
          scoreboardOverlayUrl={scoreboardOverlayUrl}
          overlayKeyPending={overlayKeyPending}
          browserSourceName={scoreboardBrowserSourceName}
          onBrowserSourceNameChange={onScoreboardBrowserSourceNameChange}
          onWireToObs={onWireScoreboardToObs}
          wirePending={wireScoreboardPending}
          wireError={wireScoreboardError}
          wireSuccessAt={wireScoreboardSuccessAt}
        />
      </div>
    </div>
  );
}
