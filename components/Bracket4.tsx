"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/home-bracket.css";
import { isBye, MatchWithDropdowns } from "@/components/Bracket8TwoRounds";

/** Options for one slot: pool minus names selected in other slots, plus current value. */
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

/** Options for final top (slot 4): only the two semi 1 players (slots 0, 1). */
function optionsForFinalTop(slotSelections: string[]): string[] {
  const current = slotSelections[4];
  const opts = [slotSelections[0], slotSelections[1]].filter(Boolean);
  const uniq = [...new Set(opts)];
  if (current && !uniq.includes(current)) uniq.unshift(current);
  return uniq;
}

/** Options for final bottom (slot 5): only the two semi 2 players (slots 2, 3). */
function optionsForFinalBottom(slotSelections: string[]): string[] {
  const current = slotSelections[5];
  const opts = [slotSelections[2], slotSelections[3]].filter(Boolean);
  const uniq = [...new Set(opts)];
  if (current && !uniq.includes(current)) uniq.unshift(current);
  return uniq;
}

const EMPTY_SLOTS = Array(6).fill("") as string[];
const DEFAULT_SCORES = Array(6).fill("0") as string[];

/**
 * 4-person bracket: 2 semi-finals (slots 0–3) and 1 final (slots 4–5).
 * Final dropdowns only offer the two players from the corresponding semi.
 */
export function Bracket4({
  players,
  playerRaceToMap,
  initialSlotSelections,
  onBracketSlotsChange,
  initialScores,
  onScoreChange,
  disabled,
  matchStatusByIndex,
}: {
  players: string[];
  playerRaceToMap?: Record<string, number | null>;
  initialSlotSelections?: string[] | null;
  onBracketSlotsChange?: (slots: string[]) => void;
  /** Length 6: [top0, bottom0, top1, bottom1, topFinal, bottomFinal]. */
  initialScores?: string[] | null;
  onScoreChange?: (matchIndex: number, side: "top" | "bottom", value: string) => void;
  disabled?: boolean;
  /** Per-matchup status (length 3) for race cell background: "In Progress...", "Paused", "Completed". */
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
    initialSlotSelections?.length === 6 ? [...initialSlotSelections] : EMPTY_SLOTS
  );
  const hasAppliedInitial = useRef(false);
  const userDidEditRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitial.current || !initialSlotSelections?.length) return;
    if (initialSlotSelections.length === 6) {
      hasAppliedInitial.current = true;
      const next = [...initialSlotSelections];
      queueMicrotask(() => setSlotSelections(next));
    }
  }, [initialSlotSelections]);

  const setSlotSelection = useCallback((index: number, value: string) => {
    userDidEditRef.current = true;
    setSlotSelections((prev) => {
      const next = [...prev];
      next[index] = value;
      // Slot 4 = winner of semi 1 (0,1); slot 5 = winner of semi 2 (2,3)
      const top0 = next[0]?.trim() ?? "";
      const bottom0 = next[1]?.trim() ?? "";
      const top1 = next[2]?.trim() ?? "";
      const bottom1 = next[3]?.trim() ?? "";
      if (top0 && bottom0) {
        const t0Bye = isBye(top0);
        const b0Bye = isBye(bottom0);
        if (t0Bye && !b0Bye) next[4] = bottom0;
        else if (!t0Bye && b0Bye) next[4] = top0;
      } else next[4] = "";
      if (top1 && bottom1) {
        const t1Bye = isBye(top1);
        const b1Bye = isBye(bottom1);
        if (t1Bye && !b1Bye) next[5] = bottom1;
        else if (!t1Bye && b1Bye) next[5] = top1;
      } else next[5] = "";
      return next;
    });
  }, []);

  useEffect(() => {
    if (!userDidEditRef.current || !onBracketSlotsChange) return;
    userDidEditRef.current = false;
    onBracketSlotsChange(slotSelections);
  }, [slotSelections, onBracketSlotsChange]);

  const [scores, setScores] = useState<string[]>(() =>
    initialScores?.length === 6 ? [...initialScores] : DEFAULT_SCORES
  );
  const initialScoresSerialized =
    initialScores?.length === 6 ? JSON.stringify(initialScores) : null;
  useEffect(() => {
    if (initialScoresSerialized == null) return;
    const next = JSON.parse(initialScoresSerialized) as string[];
    queueMicrotask(() => setScores(next));
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
      if (slotIndex === 4) return optionsForFinalTop(slotSelections);
      if (slotIndex === 5) return optionsForFinalBottom(slotSelections);
      return optionsForSlot(slotIndex, slotSelections, pool);
    },
    [slotSelections, pool]
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

  const statusByIndex = matchStatusByIndex ?? Array(3).fill(null);

  return (
    <div className="home-bracket-root bracket-4" style={{ width: "100%" }}>
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
            </div>
            <div className="column two">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
