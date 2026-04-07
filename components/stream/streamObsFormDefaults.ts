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

/** Default OBS scene name for Export (graphics / video deck). */
export const DEFAULT_VIDEO_PLAYER_SCENE_NAME = "EOSLT Graphics";

/** When the API body omits `inputName` for generic browser URL routes. */
export const DEFAULT_GENERIC_BROWSER_SOURCE_NAME = "Browser source";

/** When the API body omits `inputName` for image source routes. */
export const DEFAULT_STREAM_IMAGE_SOURCE_NAME = "Image";

/** No placeholder team labels — empty until the operator picks players. */
export const EMPTY_SCOREBOARD: ScoreboardState = { awayName: "", homeName: "" };

export const DEFAULT_SCOREBOARD = EMPTY_SCOREBOARD;

export function parseScoreboardJson(json: string | undefined | null): ScoreboardState {
  if (!json?.trim()) return { ...EMPTY_SCOREBOARD };
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    return {
      awayName: typeof o.awayName === "string" ? o.awayName : "",
      homeName: typeof o.homeName === "string" ? o.homeName : "",
    };
  } catch {
    return { ...EMPTY_SCOREBOARD };
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

export function scoreboardNamesAreEmptyPair(awayName: string, homeName: string): boolean {
  return !awayName.trim() && !homeName.trim();
}

/**
 * When Convex briefly returns no names, keep the last non-empty row so the overlay does not blink.
 */
export function mergeOverlayScoreboardWithSnapshot(
  parsed: ScoreboardState,
  snapshot: ScoreboardState
): ScoreboardState {
  const parsedEmpty = scoreboardNamesAreEmptyPair(parsed.awayName, parsed.homeName);
  const snapshotHasName = Boolean(snapshot.awayName.trim() || snapshot.homeName.trim());

  if (parsedEmpty && snapshotHasName) {
    return {
      awayName: snapshot.awayName,
      homeName: snapshot.homeName,
    };
  }
  return parsed;
}

/**
 * OBS overlay: Convex can briefly send one name updated and the other empty. Without this, the empty
 * side shows “Player 1/2”. Only fill from `prevStable` when the non-empty side **changed** vs
 * `prevStable` (in-flight update); if the user cleared a slot, the non-empty side matches `prevStable`
 * and we do not restore the cleared name.
 */
export function stabilizeOverlayScoreboardDisplay(
  merged: ScoreboardState,
  prevStable: ScoreboardState | null
): ScoreboardState {
  const mH = merged.homeName.trim();
  const mA = merged.awayName.trim();

  if (!mH && !mA) {
    if (prevStable && (prevStable.homeName.trim() || prevStable.awayName.trim())) {
      return { homeName: prevStable.homeName, awayName: prevStable.awayName };
    }
    return merged;
  }

  if (!prevStable || !prevStable.homeName.trim() || !prevStable.awayName.trim()) {
    return merged;
  }

  const pH = prevStable.homeName;
  const pA = prevStable.awayName;

  if (mH && !mA && merged.homeName !== pH) {
    return { homeName: merged.homeName, awayName: pA };
  }
  if (!mH && mA && merged.awayName !== pA) {
    return { homeName: pH, awayName: merged.awayName };
  }

  return merged;
}
