export type ScoreboardState = {
  awayName: string;
  homeName: string;
};

/** Fixed name size (px) for the OBS overlay; dashboard preview scales down proportionally in CSS. */
export const DEFAULT_SCOREBOARD_NAME_FONT_SIZE_PX = 30;

export const DEFAULT_STREAM_OBS_HOST = "192.168.1.100";
export const DEFAULT_STREAM_OBS_PORT = "4455";

/** Default OBS Browser Source input name for scoreboard URL wiring. */
export const DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME = "Scoreboard";

/** Default OBS Browser Source input name for tournament results overlay URL wiring. */
export const DEFAULT_RESULTS_BROWSER_SOURCE_NAME = "Results";

/** Default OBS Browser Source input name for SFX / audio overlay URL wiring. */
export const DEFAULT_SFX_BROWSER_SOURCE_NAME = "SFX";

/** When the API body omits `inputName` for generic browser URL routes. */
export const DEFAULT_GENERIC_BROWSER_SOURCE_NAME = "Browser source";

/** When the API body omits `inputName` for image source routes. */
export const DEFAULT_STREAM_IMAGE_SOURCE_NAME = "Image";

export const DEFAULT_SCOREBOARD: ScoreboardState = {
  awayName: "Team A",
  homeName: "Team B",
};

export function parseScoreboardJson(json: string | undefined | null): ScoreboardState {
  if (!json?.trim()) return DEFAULT_SCOREBOARD;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return {
      awayName: typeof o.awayName === "string" ? o.awayName : DEFAULT_SCOREBOARD.awayName,
      homeName: typeof o.homeName === "string" ? o.homeName : DEFAULT_SCOREBOARD.homeName,
    };
  } catch {
    return DEFAULT_SCOREBOARD;
  }
}

/** Normalize Convex `getScoreboardByOverlayKey` rows (same fields as `parseScoreboardJson`). */
export function scoreboardFromOverlayQuery(data: { awayName: string; homeName: string }): ScoreboardState {
  return parseScoreboardJson(
    JSON.stringify({
      awayName: data.awayName,
      homeName: data.homeName,
    })
  );
}

/** Case-insensitive match to default overlay placeholder names (stored JSON may vary casing). */
export function scoreboardNamesAreDefaultPlaceholderPair(awayName: string, homeName: string): boolean {
  const a = awayName.trim().toLowerCase();
  const h = homeName.trim().toLowerCase();
  return (
    a === DEFAULT_SCOREBOARD.awayName.trim().toLowerCase() &&
    h === DEFAULT_SCOREBOARD.homeName.trim().toLowerCase()
  );
}

/**
 * OBS overlay: Convex / the client can briefly yield rows that parse to placeholder team names.
 * Keep the last good names so the card does not jump.
 */
export function mergeOverlayScoreboardWithSnapshot(
  parsed: ScoreboardState,
  snapshot: ScoreboardState
): ScoreboardState {
  const parsedIsPlaceholderPair = scoreboardNamesAreDefaultPlaceholderPair(
    parsed.awayName,
    parsed.homeName
  );
  const snapshotHadCustomNames = !scoreboardNamesAreDefaultPlaceholderPair(
    snapshot.awayName,
    snapshot.homeName
  );

  if (parsedIsPlaceholderPair && snapshotHadCustomNames) {
    return {
      ...parsed,
      awayName: snapshot.awayName,
      homeName: snapshot.homeName,
    };
  }
  return parsed;
}
