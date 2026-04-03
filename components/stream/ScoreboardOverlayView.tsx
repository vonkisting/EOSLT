"use client";

import {
  DEFAULT_SCOREBOARD_NAME_FONT_SIZE_PX,
  type ScoreboardState,
} from "@/components/stream/streamObsFormDefaults";
import styles from "@/components/stream/scorecard.module.css";
import { useLayoutEffect, useRef, useState } from "react";

/** Dashboard preview scales overlay name size (historically ~14px when overlay was 26px). */
const DASHBOARD_NAME_FONT_SCALE = 14 / 26;

/** Matches `padding-inline: max(50px, 1.5rem)` on player rows. */
function horizontalPlayerPaddingPx(): number {
  if (typeof document === "undefined") return 50;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.max(50, 1.5 * rem);
}

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

  const measureHomeRef = useRef<HTMLSpanElement>(null);
  const measureAwayRef = useRef<HTMLSpanElement>(null);
  const [playerBoxWidthPx, setPlayerBoxWidthPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!compact) {
      setPlayerBoxWidthPx(null);
      return;
    }
    const h = measureHomeRef.current?.offsetWidth ?? 0;
    const a = measureAwayRef.current?.offsetWidth ?? 0;
    const textW = Math.max(h, a, 1);
    const padX = horizontalPlayerPaddingPx();
    const borderX = 4;
    setPlayerBoxWidthPx(Math.ceil(textW + 2 * padX + borderX));
  }, [compact, homeLabel, awayLabel, nameFontSizePx]);

  const playerBoxStyle =
    compact && playerBoxWidthPx != null
      ? ({
          width: playerBoxWidthPx,
          minWidth: playerBoxWidthPx,
          maxWidth: playerBoxWidthPx,
        } as const)
      : undefined;

  return (
    <div className={`${styles.scorecard} ${compact ? styles.scorecardCompact : ""}`.trim()}>
      {compact ? (
        <>
          <span ref={measureHomeRef} className={styles.measureName} style={nameStyle}>
            {homeLabel}
          </span>
          <span ref={measureAwayRef} className={styles.measureName} style={nameStyle}>
            {awayLabel}
          </span>
        </>
      ) : null}

      <div
        className={`${styles.player} ${styles.playerLeft} player player-left`}
        style={playerBoxStyle}
      >
        <div className={styles.name} style={nameStyle}>
          {homeLabel}
        </div>
      </div>

      <div className={`${styles.vs} vs`} style={vsStyle}>
        VS
      </div>

      <div
        className={`${styles.player} ${styles.playerRight} player player-right`}
        style={playerBoxStyle}
      >
        <div className={styles.name} style={nameStyle}>
          {awayLabel}
        </div>
      </div>
    </div>
  );
}
