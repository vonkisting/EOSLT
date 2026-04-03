/** Stable IDs for stream OBS collapsible cards (Convex + context). */
export const STREAM_OBS_CARD_IDS = {
  connection: "obs-connection",
  sceneSelection: "scene-selection",
  soundEffects: "sound-effects",
  camerasSources: "cameras-sources",
  audio: "audio",
  scoreboard: "scoreboard",
  tournamentSettings: "tournament-settings",
  /** Nested section under Tournament Settings (same Convex `cardOpenByIdJson` as other cards). */
  tournamentPlayerList: "tournament-settings-player-list",
} as const;
