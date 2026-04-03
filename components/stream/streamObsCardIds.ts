/** Stable IDs for stream OBS collapsible cards (Convex + context). */
export const STREAM_OBS_CARD_IDS = {
  connection: "obs-connection",
  sceneSelection: "scene-selection",
  soundEffects: "sound-effects",
  camerasSources: "cameras-sources",
  audio: "audio",
  scoreboard: "scoreboard",
  tournamentSettings: "tournament-settings",
  /** @deprecated Merged into `tournamentResults` panel; kept for older saved UI state JSON. */
  tournamentPlayerList: "tournament-settings-player-list",
  tournamentResults: "tournament-results-preview",
} as const;
