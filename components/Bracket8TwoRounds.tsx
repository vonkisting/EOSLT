"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/home-bracket.css";

/** Options for one slot: pool minus names selected in other slots, plus current value so it displays. */
function optionsForSlot(
  slotIndex: number,
  slotSelections: string[],
  pool: string[]
): string[] {
  const current = slotSelections[slotIndex];
  return pool.filter(
    (name) =>
      name === current ||
      !slotSelections.some((s, j) => j !== slotIndex && s === name)
  );
}

/** First round = slots 0–7. Exclude names selected in any other first-round slot (this card or others). */
const FIRST_ROUND_SLOT_COUNT = 8;
/** Second round = slots 8–11. Each slot's options are only the two first-round players that feed into it. */
const SECOND_ROUND_FIRST_SLOT = 8;

/** Options for a second-round slot: only the two first-round players that feed into this match (plus current so it displays). */
function optionsForSecondRoundSlot(
  slotIndex: number,
  slotSelections: string[]
): string[] {
  const current = slotSelections[slotIndex];
  const pairIndex = slotIndex - SECOND_ROUND_FIRST_SLOT; // 0,1,2,3
  const top = slotSelections[pairIndex * 2];     // slots 0,2,4,6
  const bottom = slotSelections[pairIndex * 2 + 1]; // slots 1,3,5,7
  const opts = [top, bottom].filter(Boolean);
  const uniq = [...new Set(opts)];
  if (current && !uniq.includes(current)) uniq.unshift(current);
  return uniq;
}

function optionsForFirstRoundSlot(
  slotIndex: number,
  slotSelections: string[],
  pool: string[],
  cardIndex: number,
  allFirstRoundSelections: string[]
): string[] {
  const current = slotSelections[slotIndex];
  return pool.filter((name) => {
    if (name === current) return true;
    // Exclude if selected in another first-round slot in this card
    for (let j = 0; j < FIRST_ROUND_SLOT_COUNT; j++)
      if (j !== slotIndex && slotSelections[j] === name) return false;
    // Exclude if selected in any first-round slot in another card
    const myGlobalStart = cardIndex * FIRST_ROUND_SLOT_COUNT;
    for (let k = 0; k < allFirstRoundSelections.length; k++) {
      if (k >= myGlobalStart && k < myGlobalStart + FIRST_ROUND_SLOT_COUNT)
        continue;
      if (allFirstRoundSelections[k] === name) return false;
    }
    return true;
  });
}

/**
 * Single match row with dropdowns for top/bottom names.
 * Slot indices identify which global slot each side uses for selection state.
 */
function matchStatusClass(status: string | null | undefined): string {
  if (!status) return "";
  if (status === "In Progress...") return "match-status-in-progress";
  if (status === "Paused" || status === "Paused...") return "match-status-paused";
  if (status === "Completed") return "match-status-completed";
  return "";
}

function MatchWithDropdowns({
  winner,
  topSlotIndex,
  bottomSlotIndex,
  slotSelections,
  setSlotSelection,
  topOptions,
  bottomOptions,
  topScore,
  bottomScore,
  playerRaceToMap,
  disabled,
  hasBye,
  onTopScoreChange,
  onBottomScoreChange,
  status,
}: {
  winner: "top" | "bottom";
  topSlotIndex: number;
  bottomSlotIndex: number;
  slotSelections: string[];
  setSlotSelection: (index: number, value: string) => void;
  topOptions: string[];
  bottomOptions: string[];
  topScore: string;
  bottomScore: string;
  playerRaceToMap?: Record<string, number | null>;
  disabled?: boolean;
  /** When true, a dark overlay pseudo-element is shown (home page bye matchups). */
  hasBye?: boolean;
  /** When set and !disabled, top score is an editable input; onChange saves to Convex. */
  onTopScoreChange?: (value: string) => void;
  onBottomScoreChange?: (value: string) => void;
  /** Matchup status for race cell background: "In Progress...", "Paused", "Completed". */
  status?: string | null;
}) {
  const winnerClass = winner === "top" ? "winner-top" : "winner-bottom";
  const topValue = slotSelections[topSlotIndex] ?? "";
  const bottomValue = slotSelections[bottomSlotIndex] ?? "";
  const topRaceTo = topValue && playerRaceToMap?.[topValue];
  const bottomRaceTo = bottomValue && playerRaceToMap?.[bottomValue];
  const formatRace = (v: number | null | undefined | string) =>
    v != null && v !== "" ? String(v) : "0";
  const canEditScores = !disabled && (onTopScoreChange != null || onBottomScoreChange != null);
  const statusClass = matchStatusClass(status);

  return (
    <div className={`match ${winnerClass}${hasBye ? " match-has-bye" : ""} ${statusClass}`.trim()}>
      <div className={`match-top team ${topValue ? "slot-filled" : ""}`}>
          <span className="image" />
          <span className="seed" />
          <span className="race">{formatRace(topRaceTo)}</span>
          <select
            className={`name bracket-slot-select ${topValue ? "slot-filled" : ""}`}
            value={topValue}
            onChange={(e) => setSlotSelection(topSlotIndex, e.target.value)}
            disabled={disabled}
            aria-label="Top player"
          >
            <option value="">Select Player...</option>
            {topOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        {canEditScores && onTopScoreChange ? (
          <input
            type="text"
            className="score score-input"
            value={topScore}
            onChange={(e) => onTopScoreChange(e.target.value)}
            aria-label="Top player score"
            inputMode="numeric"
          />
        ) : (
          <span className="score">{topScore}</span>
        )}
      </div>
      <div className={`match-bottom team ${bottomValue ? "slot-filled" : ""}`}>
          <span className="image" />
          <span className="seed" />
          <span className="race">{formatRace(bottomRaceTo)}</span>
          <select
            className={`name bracket-slot-select ${bottomValue ? "slot-filled" : ""}`}
            value={bottomValue}
            onChange={(e) => setSlotSelection(bottomSlotIndex, e.target.value)}
            disabled={disabled}
            aria-label="Bottom player"
          >
            <option value="">Select Player...</option>
            {bottomOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        {canEditScores && onBottomScoreChange ? (
          <input
            type="text"
            className="score score-input"
            value={bottomScore}
            onChange={(e) => onBottomScoreChange(e.target.value)}
            aria-label="Bottom player score"
            inputMode="numeric"
          />
        ) : (
          <span className="score">{bottomScore}</span>
        )}
      </div>
      <div className="match-lines">
        <div className="line one" />
        <div className="line two" />
      </div>
      <div className="match-lines alt">
        <div className="line one" />
      </div>
    </div>
  );
}

/**
 * 8-person bracket showing round 1 (4 matches) and round 2 (2 matches).
 * Each matchup side has a dropdown; selecting a player removes them from other dropdowns.
 */
/** Matches unnumbered or numbered bye labels (dashboard uses "-- Bye --", we display "-- Bye N --"). */
function isBye(name: string): boolean {
  return (
    name === "-- Bye --" ||
    name === "— Bye —" ||
    /^-- Bye \d+ --$/.test(name) ||
    /^— Bye \d+ —$/.test(name)
  );
}

const EMPTY_SLOTS = Array(12).fill("") as string[];
const DEFAULT_SCORES = Array(12).fill("0") as string[];

/** Length 64: first-round slot values for all 8 Week 1 cards (cardIndex*8 + slot 0..7). */
export type AllFirstRoundSelections = string[];

export function Bracket8TwoRounds({
  players,
  playerRaceToMap,
  initialSlotSelections,
  onBracketSlotsChange,
  initialScores,
  onScoreChange,
  cardIndex,
  allFirstRoundSelections,
  disabled,
  matchStatusByIndex,
}: {
  players: string[];
  playerRaceToMap?: Record<string, number | null>;
  initialSlotSelections?: string[] | null;
  onBracketSlotsChange?: (slots: string[]) => void;
  /** Length 12: [top0, bottom0, top1, bottom1, ...] for the 6 matchups. */
  initialScores?: string[] | null;
  onScoreChange?: (matchIndex: number, side: "top" | "bottom", value: string) => void;
  /** When set with allFirstRoundSelections, first-round dropdowns exclude names selected in other cards. */
  cardIndex?: number;
  allFirstRoundSelections?: AllFirstRoundSelections;
  /** When true, all slot dropdowns are disabled (e.g. tournament started). */
  disabled?: boolean;
  /** Per-matchup status (length 6) for race cell background: "In Progress...", "Paused", "Completed". */
  matchStatusByIndex?: (string | null)[];
}) {
  const pool = useMemo(() => {
    const filtered = players.filter((n) => n != null && n !== "");
    const byes = filtered.filter((n) => isBye(n));
    const rest = filtered
      .filter((n) => !isBye(n))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const numberedByes = byes.map((_, i) => `-- Bye ${i + 1} --`);
    return [...rest, ...numberedByes];
  }, [players]);
  const [slotSelections, setSlotSelections] = useState<string[]>(() =>
    initialSlotSelections?.length === 12 ? [...initialSlotSelections] : EMPTY_SLOTS
  );
  const hasAppliedInitial = useRef(false);
  const userDidEditRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitial.current || !initialSlotSelections?.length) return;
    if (initialSlotSelections.length === 12) {
      hasAppliedInitial.current = true;
      setSlotSelections([...initialSlotSelections]);
    }
  }, [initialSlotSelections]);

  const setSlotSelection = useCallback((index: number, value: string) => {
    userDidEditRef.current = true;
    setSlotSelections((prev) => {
      const next = [...prev];
      next[index] = value;
      for (let m = 0; m < 4; m++) {
        const topSlot = m * 2;
        const bottomSlot = m * 2 + 1;
        const topVal = next[topSlot]?.trim() ?? "";
        const bottomVal = next[bottomSlot]?.trim() ?? "";
        const secondSlot = SECOND_ROUND_FIRST_SLOT + m;
        if (topVal && bottomVal) {
          const topIsBye = isBye(topVal);
          const bottomIsBye = isBye(bottomVal);
          if (topIsBye && !bottomIsBye) next[secondSlot] = bottomVal;
          else if (!topIsBye && bottomIsBye) next[secondSlot] = topVal;
        } else if (!topVal || !bottomVal) {
          next[secondSlot] = "";
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!userDidEditRef.current || !onBracketSlotsChange) return;
    userDidEditRef.current = false;
    onBracketSlotsChange(slotSelections);
  }, [slotSelections, onBracketSlotsChange]);

  const [scores, setScores] = useState<string[]>(() =>
    initialScores?.length === 12 ? [...initialScores] : DEFAULT_SCORES
  );
  const initialScoresSerialized =
    initialScores?.length === 12 ? JSON.stringify(initialScores) : null;
  useEffect(() => {
    if (initialScoresSerialized == null) return;
    const next = JSON.parse(initialScoresSerialized) as string[];
    setScores(next);
  }, [initialScoresSerialized]);

  const handleScoreChange = useCallback(
    (matchIndex: number, side: "top" | "bottom", value: string) => {
      const i = matchIndex * 2 + (side === "top" ? 0 : 1);
      setScores((prev) => {
        const next = [...prev];
        next[i] = value;
        return next;
      });
      onScoreChange?.(matchIndex, side, value);
    },
    [onScoreChange]
  );

  const getOptions = useCallback(
    (slotIndex: number) => {
      if (slotIndex >= SECOND_ROUND_FIRST_SLOT)
        return optionsForSecondRoundSlot(slotIndex, slotSelections);
      const useGlobalFirstRound =
        cardIndex != null &&
        allFirstRoundSelections != null &&
        allFirstRoundSelections.length === 64 &&
        slotIndex < FIRST_ROUND_SLOT_COUNT;
      if (useGlobalFirstRound)
        return optionsForFirstRoundSlot(
          slotIndex,
          slotSelections,
          pool,
          cardIndex,
          allFirstRoundSelections
        );
      return optionsForSlot(slotIndex, slotSelections, pool);
    },
    [slotSelections, pool, cardIndex, allFirstRoundSelections]
  );

  const matchupHasBye = useCallback(
    (topSlotIndex: number, bottomSlotIndex: number) => {
      const top = slotSelections[topSlotIndex]?.trim() ?? "";
      const bottom = slotSelections[bottomSlotIndex]?.trim() ?? "";
      if (!top || !bottom) return false;
      return isBye(top) || isBye(bottom);
    },
    [slotSelections]
  );

  const statusByIndex = matchStatusByIndex ?? Array(6).fill(null);

  return (
    <div className="home-bracket-root bracket-8-two-rounds" style={{ width: "100%" }}>
      <div className="theme theme-dark-trendy">
        <div className="bracket disable-image">
          <div className="bracket-columns">
            <div className="column one">
              <MatchWithDropdowns
                winner="top"
                topSlotIndex={0}
                bottomSlotIndex={1}
                status={statusByIndex[0]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(0)}
                bottomOptions={getOptions(1)}
                topScore={scores[0] ?? "0"}
                bottomScore={scores[1] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(0, 1)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(0, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(0, "bottom", v) : undefined}
              />
              <MatchWithDropdowns
                winner="bottom"
                topSlotIndex={2}
                bottomSlotIndex={3}
                status={statusByIndex[1]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(2)}
                bottomOptions={getOptions(3)}
                topScore={scores[2] ?? "0"}
                bottomScore={scores[3] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(2, 3)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(1, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(1, "bottom", v) : undefined}
              />
              <MatchWithDropdowns
                winner="top"
                topSlotIndex={4}
                bottomSlotIndex={5}
                status={statusByIndex[2]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(4)}
                bottomOptions={getOptions(5)}
                topScore={scores[4] ?? "0"}
                bottomScore={scores[5] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(4, 5)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(2, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(2, "bottom", v) : undefined}
              />
              <MatchWithDropdowns
                winner="top"
                topSlotIndex={6}
                bottomSlotIndex={7}
                status={statusByIndex[3]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(6)}
                bottomOptions={getOptions(7)}
                topScore={scores[6] ?? "0"}
                bottomScore={scores[7] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(6, 7)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(3, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(3, "bottom", v) : undefined}
              />
            </div>
            <div className="column two">
              <MatchWithDropdowns
                winner="bottom"
                topSlotIndex={8}
                bottomSlotIndex={9}
                status={statusByIndex[4]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(8)}
                bottomOptions={getOptions(9)}
                topScore={scores[8] ?? "0"}
                bottomScore={scores[9] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(8, 9)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(4, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(4, "bottom", v) : undefined}
              />
              <MatchWithDropdowns
                winner="bottom"
                topSlotIndex={10}
                bottomSlotIndex={11}
                status={statusByIndex[5]}
                slotSelections={slotSelections}
                setSlotSelection={setSlotSelection}
                topOptions={getOptions(10)}
                bottomOptions={getOptions(11)}
                topScore={scores[10] ?? "0"}
                bottomScore={scores[11] ?? "0"}
                playerRaceToMap={playerRaceToMap}
                disabled={disabled}
                hasBye={disabled && matchupHasBye(10, 11)}
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(5, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(5, "bottom", v) : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
