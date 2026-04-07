"use client";

import { ObsAudioPanel, type AudioChannel } from "@/components/stream/ObsAudioPanel";
import { ObsGraphicsEffectsPanel, type GraphicsEffect } from "@/components/stream/ObsGraphicsEffectsPanel";
import { ObsScenesPanel } from "@/components/stream/ObsScenesPanel";
import { ObsScoreboardPanel, type ScoreboardState } from "@/components/stream/ObsScoreboardPanel";
import { ObsSoundboardPanel, type SoundboardEffect } from "@/components/stream/ObsSoundboardPanel";
import { ObsSourcesPanel, type SourceToggle } from "@/components/stream/ObsSourcesPanel";
import {
  ObsTournamentResultsPanel,
  type TournamentSettingsState,
} from "@/components/stream/ObsTournamentResultsPanel";
import { ObsTournamentSettingsPanel } from "@/components/stream/ObsTournamentSettingsPanel";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import type { RefObject } from "react";

export type StreamObsGridCardByIdProps = {
  cardId: string;
  connectionName: string;
  soundboardEffects: SoundboardEffect[];
  graphicsEffects: GraphicsEffect[];
  graphicsObsReady: boolean;
  activeScene: string | null;
  scenes: string[];
  scenesLoading: boolean;
  scenesError: string | null;
  onSelectScene: (name: string) => void;
  switchingScene: string | null;
  onTriggerSfx: (soundId: string) => void;
  onSfxListRefresh?: () => void;
  onTriggerGraphics: (graphicId: string) => void;
  onGraphicsListRefresh?: () => void;
  graphicsTriggerError: string | null;
  sources: SourceToggle[];
  onToggleSource: (item: SourceToggle) => void | Promise<void>;
  sourcesLoading: boolean;
  sourcesError: string | null;
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
  tournamentPlayerNames: string[];
};

export function StreamObsGridCardById(props: StreamObsGridCardByIdProps) {
  const { cardId } = props;
  switch (cardId) {
    case STREAM_OBS_CARD_IDS.sceneSelection:
      return (
        <ObsScenesPanel
          connected
          scenes={props.scenes}
          activeScene={props.activeScene}
          onSelectScene={props.onSelectScene}
          loading={props.scenesLoading}
          error={props.scenesError}
          switchingScene={props.switchingScene}
        />
      );
    case STREAM_OBS_CARD_IDS.soundEffects:
      return (
        <ObsSoundboardPanel
          sfxCueEnabled={props.connectionName.trim().length > 0}
          effects={props.soundboardEffects}
          onTrigger={props.onTriggerSfx}
          onSfxListRefresh={props.onSfxListRefresh}
        />
      );
    case STREAM_OBS_CARD_IDS.graphicsEffects:
      return (
        <ObsGraphicsEffectsPanel
          graphicsObsReady={props.graphicsObsReady}
          effects={props.graphicsEffects}
          onTrigger={props.onTriggerGraphics}
          onGraphicsListRefresh={props.onGraphicsListRefresh}
          triggerError={props.graphicsTriggerError}
        />
      );
    case STREAM_OBS_CARD_IDS.camerasSources:
      return (
        <ObsSourcesPanel
          connected
          sources={props.sources}
          onToggle={props.onToggleSource}
          loading={props.sourcesLoading}
          error={props.sourcesError}
          togglingKey={props.togglingKey}
        />
      );
    case STREAM_OBS_CARD_IDS.audio:
      return (
        <ObsAudioPanel
          connected
          channels={props.audioChannels}
          loading={props.audioLoading}
          error={props.audioError}
          onVolumeChange={props.onAudioVolumeChange}
          onMuteToggle={props.onAudioMute}
        />
      );
    case STREAM_OBS_CARD_IDS.tournamentSettings:
      return (
        <ObsTournamentSettingsPanel
          value={props.tournamentSettings}
          onChange={props.onTournamentSettingsChange}
          onPersistRequest={props.onTournamentPersistRequest}
        />
      );
    case STREAM_OBS_CARD_IDS.tournamentResults:
      return (
        <ObsTournamentResultsPanel
          settings={props.tournamentSettings}
          resultsPreviewOuterRef={props.resultsPreviewOuterRef}
        />
      );
    case STREAM_OBS_CARD_IDS.scoreboard:
      return (
        <ObsScoreboardPanel
          value={props.scoreboard}
          onChange={props.onScoreboardChange}
          tournamentPlayerNames={props.tournamentPlayerNames}
        />
      );
    default:
      return null;
  }
}
