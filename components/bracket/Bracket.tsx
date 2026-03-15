"use client";

import { Fragment } from "react";
import type { BracketData, Round } from "@/types/bracket";
import { MatchBox } from "./MatchBox";

/** Fixed card height and gap so connector lines align. Must match bracket column layout. */
export const CARD_HEIGHT_PX = 108;
const GAP_PX = 32;
/** (card + gap) / 2 so next round's first match centers between two previous. */
const ROUND_TOP_OFFSET_PX = (CARD_HEIGHT_PX + GAP_PX) / 2;

/** Round 2 second card top for 8-player (tuned). Use formula for 16+ players. */
const R2_CARD_2_TOP_8_PLAYERS_PX = 175;

/**
 * Round 2 card i (0-based) top offset. For 8 players: 1st at 70, 2nd at 175 (tuned).
 * For more than 8 players: center between R1 cards 2*i and 2*i+1.
 * Editable later via R2_CARD_2_TOP_8_PLAYERS_PX or props.
 */
function round2CardTopPx(matchIndex: number, round2MatchCount: number): number {
  if (round2MatchCount <= 2) {
    return matchIndex === 0 ? ROUND_TOP_OFFSET_PX : R2_CARD_2_TOP_8_PLAYERS_PX;
  }
  return (4 * matchIndex + 1) * ROUND_TOP_OFFSET_PX;
}

/** Right-center Y of the card at cardIndex in the left column feeding this connector. */
function leftCardCenterY(
  leftRoundIndex: number,
  leftMatchCount: number,
  cardIndex: number
): number {
  if (leftRoundIndex === 0) {
    const step = CARD_HEIGHT_PX + GAP_PX;
    return PLAYER_ROWS_CENTER_OFFSET_PX + cardIndex * step;
  }
  if (leftRoundIndex === 1) {
    return round2CardTopPx(cardIndex, leftMatchCount) + PLAYER_ROWS_CENTER_OFFSET_PX;
  }
  const step = CARD_HEIGHT_PX + GAP_PX;
  const paddingTop = leftRoundIndex * ROUND_TOP_OFFSET_PX;
  return paddingTop + cardIndex * step + PLAYER_ROWS_CENTER_OFFSET_PX;
}

/** Height of the left column for connector sizing (round 2 has non-uniform card positions). */
function leftColumnHeightPx(leftRoundIndex: number, leftMatchCount: number): number {
  if (leftRoundIndex === 1) {
    return (
      round2CardTopPx(leftMatchCount - 1, leftMatchCount) + CARD_HEIGHT_PX
    );
  }
  return columnHeight(leftMatchCount);
}

/** Top Y of a card in a round column (1-based round number). Used so connector final segment aligns with right column card center. */
function cardTopInRoundColumn(
  roundNumber: number,
  matchIndex: number,
  matchCount: number
): number {
  if (roundNumber === 1) {
    return matchIndex * (CARD_HEIGHT_PX + GAP_PX);
  }
  if (roundNumber === 2) {
    return round2CardTopPx(matchIndex, matchCount);
  }
  return (
    (roundNumber - 1) * ROUND_TOP_OFFSET_PX +
    matchIndex * (CARD_HEIGHT_PX + GAP_PX)
  );
}

/** Vertical offset from top of card to center of the two player rows (header + one row height). */
const PLAYER_ROWS_CENTER_OFFSET_PX = 32 + 36;

/** Width of the connector lane between columns (lines draw here). */
const CONNECTOR_WIDTH_PX = 96;

const COLUMN_MIN_WIDTH = 200;

function columnHeight(matchCount: number): number {
  return (
    matchCount * CARD_HEIGHT_PX + Math.max(0, matchCount - 1) * GAP_PX
  );
}

/**
 * Horizontal single-elimination bracket: rounds left to right.
 * First two R1 cards connect to first R2 card, etc. Connectors sit directly between columns.
 */
export function Bracket({ data }: { data: BracketData }) {
  const lastRound = data.rounds[data.rounds.length - 1];
  const hasChampion = lastRound?.matches.length === 1;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex flex-col">
        {/* Labels row: one label per round + spacer above each connector, + Champion label */}
        <div className="inline-flex min-w-max items-center px-4 pb-0.5" style={{ gap: 0 }}>
          {data.rounds.map((round, idx) => (
            <Fragment key={round.roundNumber}>
              <div
                className="shrink-0 text-center"
                style={{ minWidth: COLUMN_MIN_WIDTH }}
              >
                <h3 className="text-sm font-medium text-slate-400">
                  {round.name}
                </h3>
              </div>
              {idx < data.rounds.length - 1 ? (
                <div style={{ width: CONNECTOR_WIDTH_PX }} />
              ) : hasChampion ? (
                <div style={{ width: CONNECTOR_WIDTH_PX }} />
              ) : null}
            </Fragment>
          ))}
          {hasChampion && (
            <div
              className="shrink-0 text-center"
              style={{ minWidth: COLUMN_MIN_WIDTH }}
            >
              <h3 className="text-sm font-medium text-slate-400">Champion</h3>
            </div>
          )}
        </div>

        {/* Content row: Round column, Connector, Round column, ... then Champion. Align at top so later rounds sit centered between feeding pairs. */}
        <div
          className="inline-flex min-w-max items-start px-4 pt-2 pb-2"
          style={{ gap: 0 }}
        >
          {data.rounds.map((round, idx) => (
            <Fragment key={round.roundNumber}>
              <RoundColumn round={round} />
              {idx < data.rounds.length - 1 ? (
                <ConnectorLines
                  leftRoundIndex={idx}
                  leftMatchCount={round.matches.length}
                  rightMatchCount={data.rounds[idx + 1].matches.length}
                />
              ) : hasChampion ? (
                <ConnectorLines
                  leftRoundIndex={idx}
                  leftMatchCount={round.matches.length}
                  rightMatchCount={1}
                />
              ) : null}
            </Fragment>
          ))}
          {hasChampion && (
            <div className="flex shrink-0 flex-col items-center gap-0.5" style={{ minWidth: COLUMN_MIN_WIDTH }}>
              <div className="rounded-lg border-2 border-sky-400/60 bg-sky-800/90 px-4 py-2 text-center shadow-lg">
                <div className="text-xs font-medium uppercase tracking-wider text-sky-300">
                  Champion
                </div>
                <div className="mt-0.5 text-sm font-semibold text-white">
                  —
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectorLines({
  leftRoundIndex,
  leftMatchCount,
  rightMatchCount,
}: {
  leftRoundIndex: number;
  leftMatchCount: number;
  rightMatchCount: number;
}) {
  const leftHeight = leftColumnHeightPx(leftRoundIndex, leftMatchCount);
  const midX = CONNECTOR_WIDTH_PX / 2;
  const rightRoundNumber = leftRoundIndex + 2;

  const paths: string[] = [];
  for (let i = 0; i < rightMatchCount; i++) {
    if (leftMatchCount === 1 && rightMatchCount === 1) {
      const y = leftCardCenterY(leftRoundIndex, leftMatchCount, 0);
      paths.push(`M 0 ${y} H ${CONNECTOR_WIDTH_PX}`);
    } else {
      const leftY1 = leftCardCenterY(leftRoundIndex, leftMatchCount, 2 * i);
      const leftY2 = leftCardCenterY(leftRoundIndex, leftMatchCount, 2 * i + 1);
      const midY = (leftY1 + leftY2) / 2;
      const rightCardCenterY =
        cardTopInRoundColumn(rightRoundNumber, i, rightMatchCount) +
        PLAYER_ROWS_CENTER_OFFSET_PX;
      paths.push(
        `M 0 ${leftY1} H ${midX} V ${leftY2} M 0 ${leftY2} H ${midX} M ${midX} ${midY} V ${rightCardCenterY} H ${CONNECTOR_WIDTH_PX}`
      );
    }
  }

  return (
    <div
      className="flex shrink-0 items-start overflow-visible"
      style={{
        width: CONNECTOR_WIDTH_PX,
        height: leftHeight,
        minHeight: leftHeight,
      }}
    >
      <svg
        width={CONNECTOR_WIDTH_PX}
        height={leftHeight}
        viewBox={`0 0 ${CONNECTOR_WIDTH_PX} ${leftHeight}`}
        className="text-slate-500"
        style={{ overflow: "visible" }}
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

function RoundColumn({ round }: { round: Round }) {
  const isRound2 = round.roundNumber === 2;
  const paddingTop =
    round.roundNumber > 1 && !isRound2
      ? (round.roundNumber - 1) * ROUND_TOP_OFFSET_PX
      : 0;

  return (
    <div
      className="flex flex-col items-start shrink-0"
      style={{
        paddingTop: isRound2 ? 0 : `${paddingTop}px`,
        minWidth: COLUMN_MIN_WIDTH,
      }}
    >
      <div
        className="flex flex-col"
        style={{ gap: isRound2 ? 0 : `${GAP_PX}px` }}
      >
        {round.matches.map((match, i) => (
          <div
            key={match.id}
            style={{
              height: CARD_HEIGHT_PX,
              ...(isRound2 && {
                marginTop: `${round2CardTopPx(i, round.matches.length)}px`,
              }),
            }}
            className="flex items-center overflow-hidden"
          >
            <MatchBox match={match} />
          </div>
        ))}
      </div>
    </div>
  );
}
