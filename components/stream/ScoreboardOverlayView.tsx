"use client";

import {
  DEFAULT_SCOREBOARD_NAME_FONT_SIZE_PX,
  type ScoreboardState,
} from "@/components/stream/streamObsFormDefaults";
import styles from "@/components/stream/scorecard.module.css";

/** Dashboard preview scales overlay name size (historically ~14px when overlay was 26px). */
const DASHBOARD_NAME_FONT_SCALE = 14 / 26;

type ScoreboardOverlayViewProps = {
  value: ScoreboardState;
  variant: "dashboard" | "overlay";
};

/** Title case each word: first letter uppercase, rest lowercase. */
function formatScorecardPlayerName(raw: string, fallback: string): string {
  const t = raw.trim();
  if (!t) return fallback;
  return t
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Name + VS layout for overlay URL and stream dashboard preview (structure matches OBS HTML/CSS).
 */
export function ScoreboardOverlayView({ value, variant }: ScoreboardOverlayViewProps) {
  const compact = variant === "dashboard";
  const homeLabel = formatScorecardPlayerName(value.homeName, "Player 1");
  const awayLabel = formatScorecardPlayerName(value.awayName, "Player 2");
  const overlayNamePx = DEFAULT_SCOREBOARD_NAME_FONT_SIZE_PX;
  const nameFontSizePx = compact
    ? Math.max(10, Math.round(overlayNamePx * DASHBOARD_NAME_FONT_SCALE))
    : overlayNamePx;
  const nameStyle = { fontSize: `${nameFontSizePx}px` } as const;
  const vsFontSizePx = nameFontSizePx;
  const vsPadY = compact ? Math.max(4, Math.round(vsFontSizePx * (6 / 16))) : Math.max(6, Math.round(vsFontSizePx * (10 / 32)));
  const vsPadX = compact ? Math.max(8, Math.round(vsFontSizePx * (12 / 16))) : Math.max(12, Math.round(vsFontSizePx * (20 / 32)));
  const vsLetterSpacing = compact ? Math.max(0.5, vsFontSizePx * (1 / 16)) : Math.max(1, vsFontSizePx * (2 / 32));
  const vsStyle = {
    fontSize: `${vsFontSizePx}px`,
    padding: `${vsPadY}px ${vsPadX}px`,
    letterSpacing: `${vsLetterSpacing}px`,
  } as const;

  return (
    <div className={`${styles.scorecard} ${compact ? styles.scorecardCompact : ""}`.trim()}>
      <div className={`${styles.player} ${styles.playerLeft} player player-left`}>
        <div className={styles.name} style={nameStyle}>
          {homeLabel}
        </div>
      </div>

      <div className={`${styles.vs} vs`} style={vsStyle}>
        VS
      </div>

      <div className={`${styles.player} ${styles.playerRight} player player-right`}>
        <div className={styles.name} style={nameStyle}>
          {awayLabel}
        </div>
      </div>
    </div>
  );
}
