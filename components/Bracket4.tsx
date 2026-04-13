"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/home-bracket.css";
import { isBye, MatchWithDropdowns } from "@/components/Bracket8TwoRounds";
import { selectOptionsFullPool } from "@/lib/dropdownOptions";

const EMPTY_SLOTS = Array(6).fill("") as string[];
const DEFAULT_SCORES = Array(6).fill("0") as string[];

/** Exported for home bracket: same effective slots 4–5 as the live Bracket4 UI after bye propagation. */
export function applyByeAdvancesToBracket4(slots: string[]): string[] {
  const next = [...slots];
  const top0 = next[0]?.trim() ?? "";
  const bottom0 = next[1]?.trim() ?? "";
  const top1 = next[2]?.trim() ?? "";
  const bottom1 = next[3]?.trim() ?? "";

  if (!top0 || !bottom0) next[4] = "";
  else if (isBye(top0) && !isBye(bottom0)) next[4] = bottom0;
  else if (!isBye(top0) && isBye(bottom0)) next[4] = top0;
  else if (isBye(top0) && isBye(bottom0)) next[4] = "";

  if (!top1 || !bottom1) next[5] = "";
  else if (isBye(top1) && !isBye(bottom1)) next[5] = bottom1;
  else if (!isBye(top1) && isBye(bottom1)) next[5] = top1;
  else if (isBye(top1) && isBye(bottom1)) next[5] = "";

  return next;
}

/**
 * 4-person bracket: 2 semi-finals (slots 0–3) and 1 final (slots 4–5).
 * Each slot dropdown lists the full player pool.
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
  placeholderText,
  onMatchClickByIndex,
  /** Dashboard: right-click a player name to open the live scorecard for that matchup. */
  onMatchNameContextMenu,
  matchForfeitingPlayerByMatchIndex,
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
  placeholderText?: string;
  onMatchClickByIndex?: (matchIndex: number) => void;
  onMatchNameContextMenu?: (matchIndex: number) => void;
  /** Length 3: forfeiting player name per matchup (0–1 semis, 2 final). */
  matchForfeitingPlayerByMatchIndex?: (string | null)[] | null;
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
    initialSlotSelections?.length === 6
      ? applyByeAdvancesToBracket4(initialSlotSelections)
      : EMPTY_SLOTS
  );
  const userDidEditRef = useRef(false);
  const onBracketSlotsChangeRef = useRef(onBracketSlotsChange);
  onBracketSlotsChangeRef.current = onBracketSlotsChange;

  const initialSlotSelectionsSerialized =
    initialSlotSelections?.length === 6 ? JSON.stringify(initialSlotSelections) : null;

  useEffect(() => {
    if (initialSlotSelectionsSerialized == null) return;
    const next = JSON.parse(initialSlotSelectionsSerialized) as string[];
    queueMicrotask(() => setSlotSelections(applyByeAdvancesToBracket4(next)));
  }, [initialSlotSelectionsSerialized]);

  const setSlotSelection = useCallback((index: number, value: string) => {
    userDidEditRef.current = true;
    setSlotSelections((prev) => {
      const next = [...prev];
      next[index] = value;
      return applyByeAdvancesToBracket4(next);
    });
  }, []);

  useEffect(() => {
    if (!userDidEditRef.current || !onBracketSlotsChangeRef.current) return;
    userDidEditRef.current = false;
    onBracketSlotsChangeRef.current(slotSelections);
  }, [slotSelections]);

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
    (slotIndex: number) =>
      selectOptionsFullPool(pool, slotSelections[slotIndex] ?? ""),
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
                placeholderText={placeholderText}
                onMatchClick={onMatchClickByIndex ? () => onMatchClickByIndex(0) : undefined}
                onNameContextMenu={
                  onMatchNameContextMenu ? () => onMatchNameContextMenu(0) : undefined
                }
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(0, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(0, "bottom", v) : undefined}
                forfeitingPlayerName={matchForfeitingPlayerByMatchIndex?.[0] ?? null}
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
                placeholderText={placeholderText}
                onMatchClick={onMatchClickByIndex ? () => onMatchClickByIndex(1) : undefined}
                onNameContextMenu={
                  onMatchNameContextMenu ? () => onMatchNameContextMenu(1) : undefined
                }
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(1, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(1, "bottom", v) : undefined}
                forfeitingPlayerName={matchForfeitingPlayerByMatchIndex?.[1] ?? null}
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
                placeholderText={placeholderText}
                onMatchClick={onMatchClickByIndex ? () => onMatchClickByIndex(2) : undefined}
                onNameContextMenu={
                  onMatchNameContextMenu ? () => onMatchNameContextMenu(2) : undefined
                }
                onTopScoreChange={onScoreChange ? (v) => handleScoreChange(2, "top", v) : undefined}
                onBottomScoreChange={onScoreChange ? (v) => handleScoreChange(2, "bottom", v) : undefined}
                forfeitingPlayerName={matchForfeitingPlayerByMatchIndex?.[2] ?? null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
