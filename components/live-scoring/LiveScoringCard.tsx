"use client";

import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Modal } from "@/components/ui/Modal";
import {
  resolveWinnerNameForAdvancement,
  week1TargetSlotForWinner,
} from "@/lib/bracketMatchAdvance";
import {
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
  week2SlotPairIndices,
} from "@/lib/week2BracketSlots";

type StatsRow = Record<string, string | number | null | undefined>;
function getStatValue(row: StatsRow, ...keys: string[]): string | number | null | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  const lower = keys.map((k) => k.toLowerCase());
  const found = Object.entries(row).find(([k]) => lower.includes(k.toLowerCase()));
  return found ? found[1] : undefined;
}
function toNumber(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/** Slot indices for a matchup: matchIndex 0->0,1; 1->2,3; ...; 5->10,11. */
function slotIndicesForMatch(matchIndex: number): [number, number] {
  const top = matchIndex < 4 ? matchIndex * 2 : 8 + (matchIndex - 4) * 2;
  return [top, top + 1];
}

const GAME_COUNT = 11;
const EMPTY_ROW = Array.from({ length: GAME_COUNT }, () => "");
type BracketStage = "week1" | "week2" | "finals";

function isBracketStage(value: string | null | undefined): value is BracketStage {
  return value === "week1" || value === "week2" || value === "finals";
}

/**
 * Sum each row only when both players have a value in that game cell.
 */
function sumScoresWhenBothPresent(
  row1: string[],
  row2: string[]
): { total1: number; total2: number } {
  let total1 = 0;
  let total2 = 0;
  for (let i = 0; i < row1.length; i++) {
    const v1 = (row1[i] ?? "").trim();
    const v2 = (row2[i] ?? "").trim();
    if (v1 !== "" && v2 !== "") {
      const n1 = parseInt(v1, 10);
      const n2 = parseInt(v2, 10);
      total1 += Number.isNaN(n1) ? 0 : n1;
      total2 += Number.isNaN(n2) ? 0 : n2;
    }
  }
  return { total1, total2 };
}

/**
 * Index of the first game where this player's running total (only counting games
 * with both scores) reaches >= raceTo. Returns null if never reached or raceTo is null.
 * The game at this index is the "winning game"; we only show the legal-win modal
 * when that game has both players' scores.
 */
function getWinningGameIndex(
  row1: string[],
  row2: string[],
  raceTo: number | null,
  forPlayer1: boolean
): number | null {
  if (raceTo == null) return null;
  let sum = 0;
  for (let i = 0; i < row1.length; i++) {
    const v1 = (row1[i] ?? "").trim();
    const v2 = (row2[i] ?? "").trim();
    if (v1 !== "" && v2 !== "") {
      const n = forPlayer1 ? parseInt(v1, 10) : parseInt(v2, 10);
      sum += Number.isNaN(n) ? 0 : n;
      if (sum >= raceTo) return i;
    }
  }
  return null;
}

/** Deep compare per-game cells (trimmed) for dashboard “any edits since load” checks. */
function scoresEqualToBaseline(
  p1: string[],
  p2: string[],
  baseline: { p1: string[]; p2: string[] }
): boolean {
  for (let i = 0; i < GAME_COUNT; i++) {
    if ((p1[i] ?? "").trim() !== (baseline.p1[i] ?? "").trim()) return false;
    if ((p2[i] ?? "").trim() !== (baseline.p2[i] ?? "").trim()) return false;
  }
  return true;
}

/** True iff every game row with both values has exactly one player at 10. */
function allGameRowsValid(row1: string[], row2: string[]): boolean {
  for (let i = 0; i < row1.length; i++) {
    const v1 = (row1[i] ?? "").trim();
    const v2 = (row2[i] ?? "").trim();
    if (v1 !== "" && v2 !== "") {
      const n1 = parseInt(v1, 10);
      const n2 = parseInt(v2, 10);
      if (n1 !== 10 && n2 !== 10) return false;
      if (n1 === 10 && n2 === 10) return false;
    }
  }
  return true;
}

/** Returns the error message for this game row if invalid, or null if valid. */
function getGameRowErrorMessage(
  row1: string[],
  row2: string[],
  index: number
): string | null {
  const v1 = (row1[index] ?? "").trim();
  const v2 = (row2[index] ?? "").trim();
  if (v1 === "" || v2 === "") return null;
  const n1 = parseInt(v1, 10);
  const n2 = parseInt(v2, 10);
  if (n1 === 10 && n2 === 10) return "Only 1 player can score a 10 per game.";
  if (n1 !== 10 && n2 !== 10) return "One player MUST score a 10 each game.";
  return null;
}

/** True iff this game row has both values and is invalid (both 10 or both < 10). */
function isGameRowInvalid(
  row1: string[],
  row2: string[],
  index: number
): boolean {
  return getGameRowErrorMessage(row1, row2, index) != null;
}

/**
 * Live Scoring card: header with matchup (players + avatars) and scores table.
 * Card and match indices come from URL (card 0–7, match 0–5).
 */
export function LiveScoringCard({
  cardIndex,
  matchIndex,
  stage = "week1",
  readOnly = false,
  dashboardOperator = false,
}: {
  cardIndex: number;
  matchIndex: number;
  stage?: BracketStage;
  readOnly?: boolean;
  /** Opened from /dashboard with ?dashboard=1 — allow editing when tournament is paused or not started. */
  dashboardOperator?: boolean;
}) {
  const validCard =
    stage === "week1"
      ? cardIndex >= 0 && cardIndex <= 7
      : stage === "week2"
        ? cardIndex >= 0 && cardIndex <= 3
        : cardIndex === 0;
  const validMatch =
    matchIndex >= 0 &&
    matchIndex <= (stage === "finals" ? 2 : stage === "week2" ? 2 : 5);

  const router = useRouter();
  const email = useSession().data?.user?.email?.toLowerCase().trim();
  const settings = useQuery(api.dashboardSettings.getShared, {});
  const setDashboardSettings = useMutation(api.dashboardSettings.setShared);

  const tournamentStarted =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentStarted === true;
  const tournamentPaused =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentPaused === true;
  const tournamentInProgress = tournamentStarted && !tournamentPaused;

  useEffect(() => {
    if (settings === undefined) return;
    if (!readOnly && !tournamentInProgress && !dashboardOperator) router.replace("/");
  }, [settings, tournamentInProgress, router, readOnly, dashboardOperator]);

  const [player1Scores, setPlayer1Scores] = useState<string[]>(() => [...EMPTY_ROW]);
  const [player2Scores, setPlayer2Scores] = useState<string[]>(() => [...EMPTY_ROW]);
  /** Last raw JSON we synced from Convex for this card/match so we only update state when Convex value actually changes (real-time sync across clients). */
  const lastSyncedRawRef = useRef<string | null>(null);
  /** When true, the next save effect run should skip writing (state was just set from a remote sync to avoid ping-pong). */
  const skipNextSaveRef = useRef(false);
  /** Last raw we wrote to Convex; skip applying it when it comes back so we don't re-render from our own echo. */
  const lastWrittenRawRef = useRef<string | null>(null);
  /** Scores last applied from Convex (or empty init) for this matchup — dashboard: legal-win + submit only if current state differs. */
  const baselineSnapshotRef = useRef<{ p1: string[]; p2: string[] } | null>(null);

  useEffect(() => {
    lastSyncedRawRef.current = null;
    lastWrittenRawRef.current = null;
    baselineSnapshotRef.current = null;
  }, [cardIndex, matchIndex, stage]);

  useEffect(() => {
    if (!validCard || !validMatch || !settings || typeof settings !== "object" || stage !== "week1") return;
    const key = cardIndex * 6 + matchIndex;
    const s = settings as Record<string, unknown>;
    const raw = s[`liveScoreGames${key}`];
    if (typeof raw === "string") {
      if (raw === lastSyncedRawRef.current) return;
      if (raw === lastWrittenRawRef.current) {
        lastSyncedRawRef.current = raw;
        return;
      }
      lastSyncedRawRef.current = raw;
      lastWrittenRawRef.current = null;
      skipNextSaveRef.current = true;
      try {
        const parsed = JSON.parse(raw) as { p1?: unknown[]; p2?: unknown[] };
        if (
          Array.isArray(parsed.p1) &&
          Array.isArray(parsed.p2) &&
          parsed.p1.length === GAME_COUNT &&
          parsed.p2.length === GAME_COUNT
        ) {
          const p1 = parsed.p1.map((c) => (c != null && c !== "" ? String(c).trim() : ""));
          const p2 = parsed.p2.map((c) => (c != null && c !== "" ? String(c).trim() : ""));
          if (dashboardOperator) {
            baselineSnapshotRef.current = { p1: [...p1], p2: [...p2] };
          }
          setPlayer1Scores(p1);
          setPlayer2Scores(p2);
        }
      } catch {
        lastSyncedRawRef.current = null;
      }
      return;
    }
    if (!email || readOnly) return;
    const emptyGames = JSON.stringify({
      p1: Array.from({ length: GAME_COUNT }, () => ""),
      p2: Array.from({ length: GAME_COUNT }, () => ""),
    });
    lastSyncedRawRef.current = emptyGames;
    if (dashboardOperator) {
      baselineSnapshotRef.current = { p1: [...EMPTY_ROW], p2: [...EMPTY_ROW] };
    }
    setPlayer1Scores([...EMPTY_ROW]);
    setPlayer2Scores([...EMPTY_ROW]);
    setDashboardSettings({
      email: email as string,
      leagueName: String(s.leagueName ?? ""),
      season: String(s.season ?? ""),
      [`liveScoreGames${key}`]: emptyGames,
      [`bracketScoreTop${key}`]: "0",
      [`bracketScoreBottom${key}`]: "0",
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [settings, cardIndex, matchIndex, validCard, validMatch, email, setDashboardSettings, stage, readOnly, dashboardOperator]);

  const updateScore = useCallback(
    (playerIndex: 0 | 1, gameIndex: number, value: string) => {
      if (playerIndex === 0) {
        setPlayer1Scores((prev) => {
          const next = [...prev];
          next[gameIndex] = value;
          return next;
        });
      } else {
        setPlayer2Scores((prev) => {
          const next = [...prev];
          next[gameIndex] = value;
          return next;
        });
      }
    },
    []
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (
      readOnly ||
      stage !== "week1" ||
      !email ||
      !settings ||
      typeof settings !== "object" ||
      !validCard ||
      !validMatch
    ) {
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const key = cardIndex * 6 + matchIndex;
    const s = settings as Record<string, unknown>;
    const { total1, total2 } = sumScoresWhenBothPresent(player1Scores, player2Scores);
    const bothEmpty =
      player1Scores.every((c) => !(c ?? "").trim()) &&
      player2Scores.every((c) => !(c ?? "").trim());
    if (bothEmpty) return;

    const payload = JSON.stringify({ p1: player1Scores, p2: player2Scores });
    const totals = { total1, total2 };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      lastWrittenRawRef.current = payload;
      setDashboardSettings({
        email: email as string,
        leagueName: String(s.leagueName ?? ""),
        season: String(s.season ?? ""),
        [`liveScoreGames${key}`]: payload,
        [`bracketScoreTop${key}`]: String(totals.total1),
        [`bracketScoreBottom${key}`]: String(totals.total2),
      } as Parameters<typeof setDashboardSettings>[0]);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [email, settings, validCard, validMatch, cardIndex, matchIndex, player1Scores, player2Scores, setDashboardSettings, readOnly, stage]);

  const { player1Name, player2Name, storedTopScore, storedBottomScore } = useMemo(() => {
    const s = settings as Record<string, unknown> | undefined;
    if (s == null || !validCard || !validMatch) {
      return { player1Name: "—", player2Name: "—", storedTopScore: "0", storedBottomScore: "0" };
    }
    let p1 = "";
    let p2 = "";
    let topScore = "0";
    let bottomScore = "0";
    if (stage === "week1") {
      const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
      const base = cardIndex * 12;
      p1 = ((s[`bracketSlot${base + topSlot}`] as string) ?? "").trim();
      p2 = ((s[`bracketSlot${base + bottomSlot}`] as string) ?? "").trim();
      const globalIndex = cardIndex * 6 + matchIndex;
      topScore = ((s[`bracketScoreTop${globalIndex}`] as string) ?? "0").trim() || "0";
      bottomScore = ((s[`bracketScoreBottom${globalIndex}`] as string) ?? "0").trim() || "0";
    } else if (stage === "week2") {
      const slots = parseWeek2BracketSlotsJson(s.week2BracketSlots);
      const scores = parseWeek2BracketScoresJson(s.week2BracketScores);
      const base = cardIndex * 6;
      const [topSlot, bottomSlot] = week2SlotPairIndices(matchIndex);
      p1 = (slots[base + topSlot] ?? "").trim();
      p2 = (slots[base + bottomSlot] ?? "").trim();
      const si = base + matchIndex * 2;
      topScore = (scores[si] ?? "0").trim() || "0";
      bottomScore = (scores[si + 1] ?? "0").trim() || "0";
    } else {
      const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
      const rawSlots = s.finalsBracketSlots;
      const rawScores = s.finalsBracketScores;
      if (typeof rawSlots === "string" && rawSlots.trim()) {
        try {
          const arr = JSON.parse(rawSlots) as unknown[];
          p1 = typeof arr[topSlot] === "string" ? String(arr[topSlot]).trim() : "";
          p2 = typeof arr[bottomSlot] === "string" ? String(arr[bottomSlot]).trim() : "";
        } catch {
          p1 = "";
          p2 = "";
        }
      }
      if (typeof rawScores === "string" && rawScores.trim()) {
        try {
          const arr = JSON.parse(rawScores) as unknown[];
          topScore = typeof arr[matchIndex * 2] === "string" ? String(arr[matchIndex * 2]).trim() || "0" : "0";
          bottomScore =
            typeof arr[matchIndex * 2 + 1] === "string"
              ? String(arr[matchIndex * 2 + 1]).trim() || "0"
              : "0";
        } catch {
          topScore = "0";
          bottomScore = "0";
        }
      }
    }
    return {
      player1Name: p1 || "—",
      player2Name: p2 || "—",
      storedTopScore: topScore,
      storedBottomScore: bottomScore,
    };
  }, [settings, cardIndex, matchIndex, validCard, validMatch, stage]);

  const [raceToMap, setRaceToMap] = useState<Record<string, number | null>>({});
  const leagueGuid = (settings as Record<string, unknown> | undefined)?.leagueGuid as string | undefined;
  useEffect(() => {
    if (!leagueGuid?.trim()) {
      queueMicrotask(() => setRaceToMap({}));
      return;
    }
    let cancelled = false;
    fetch(`/api/overall-player-stats?leagueGuid=${encodeURIComponent(leagueGuid)}`)
      .then((r) => r.json())
      .then((data: StatsRow[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const map: Record<string, number | null> = {};
        for (const row of data) {
          const nameVal = getStatValue(row, "Name", "name", "PlayerName", "Player");
          const name = nameVal != null && nameVal !== "" ? String(nameVal).trim() : "";
          if (!name) continue;
          const legacyAve = toNumber(
            getStatValue(row, "LegacyAverage", "LegacyAve", "legacyaverage", "legacyave", "Legacy_Average")
          );
          map[name] = legacyAve != null ? Math.ceil(legacyAve * 6) : null;
        }
        setRaceToMap(map);
      })
      .catch(() => {
        if (!cancelled) setRaceToMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [leagueGuid]);

  const player1RaceTo = useMemo(
    () => raceToMap[player1Name] ?? raceToMap[player1Name.trim()] ?? null,
    [raceToMap, player1Name]
  );
  const player2RaceTo = useMemo(
    () => raceToMap[player2Name] ?? raceToMap[player2Name.trim()] ?? null,
    [raceToMap, player2Name]
  );

  const { total1, total2 } = useMemo(
    () => sumScoresWhenBothPresent(player1Scores, player2Scores),
    [player1Scores, player2Scores]
  );
  const displayTotal1 = readOnly ? Number.parseInt(storedTopScore, 10) || 0 : total1;
  const displayTotal2 = readOnly ? Number.parseInt(storedBottomScore, 10) || 0 : total2;

  /** Dashboard (week 1): winning-ball flow + submit only after the user changes at least one cell vs loaded snapshot. */
  const hasUserEditedScores = useMemo(() => {
    if (!dashboardOperator || readOnly) return true;
    if (stage !== "week1") return true;
    const b = baselineSnapshotRef.current;
    if (b == null) return false;
    return !scoresEqualToBaseline(player1Scores, player2Scores, b);
  }, [dashboardOperator, readOnly, player1Scores, player2Scores, stage]);

  const [legalWinConfirmed, setLegalWinConfirmed] = useState(false);
  const [requireStrictExceedPlayer1, setRequireStrictExceedPlayer1] = useState(false);
  const [requireStrictExceedPlayer2, setRequireStrictExceedPlayer2] = useState(false);
  const [legalWinModalOpen, setLegalWinModalOpen] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    setLegalWinConfirmed(false);
  }, [total1, total2, readOnly]);

  useEffect(() => {
    if (readOnly || !dashboardOperator) return;
    if (hasUserEditedScores) return;
    setLegalWinConfirmed(false);
    setLegalWinModalOpen(false);
    setRequireStrictExceedPlayer1(false);
    setRequireStrictExceedPlayer2(false);
  }, [hasUserEditedScores, readOnly, dashboardOperator]);

  const p1Won = useMemo(
    () =>
      player1RaceTo != null &&
      (requireStrictExceedPlayer1 ? displayTotal1 > player1RaceTo : displayTotal1 >= player1RaceTo),
    [player1RaceTo, displayTotal1, requireStrictExceedPlayer1]
  );
  const p2Won = useMemo(
    () =>
      player2RaceTo != null &&
      (requireStrictExceedPlayer2 ? displayTotal2 > player2RaceTo : displayTotal2 >= player2RaceTo),
    [player2RaceTo, displayTotal2, requireStrictExceedPlayer2]
  );

  const totalsReached = useMemo(() => p1Won || p2Won, [p1Won, p2Won]);
  const bothHaveWinningTotals = useMemo(() => p1Won && p2Won, [p1Won, p2Won]);
  const singleWinnerName = useMemo(
    () => (p1Won && !p2Won ? player1Name : p2Won && !p1Won ? player2Name : null),
    [p1Won, p2Won, player1Name, player2Name]
  );

  const updateMatchStatus = useCallback(
    (status: string) => {
      if (
        readOnly ||
        !email ||
        !settings ||
        typeof settings !== "object" ||
        !validCard ||
        !validMatch ||
        stage !== "week1"
      ) {
        return;
      }
      const s = settings as Record<string, unknown>;
      const statusKey = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
      const payload: Record<string, unknown> = {
        email,
        leagueName: String(s.leagueName ?? ""),
        season: String(s.season ?? ""),
        tournamentStarted: s.tournamentStarted === true,
        tournamentPaused: s.tournamentPaused === true,
        [statusKey]: status,
      };
      if (status === "Completed") {
        const targetSlot = week1TargetSlotForWinner(matchIndex);
        if (targetSlot != null) {
          const winner = resolveWinnerNameForAdvancement(
            singleWinnerName,
            player1Name,
            player2Name,
            displayTotal1,
            displayTotal2
          );
          if (winner) {
            const base = cardIndex * 12;
            payload[`bracketSlot${base + targetSlot}`] = winner;
          }
        }
      }
      setDashboardSettings(payload as Parameters<typeof setDashboardSettings>[0]);
    },
    [
      email,
      settings,
      validCard,
      validMatch,
      cardIndex,
      matchIndex,
      setDashboardSettings,
      readOnly,
      stage,
      singleWinnerName,
      player1Name,
      player2Name,
      displayTotal1,
      displayTotal2,
    ]
  );

  /** Only show winning-ball confirmation when the game that put the winner's total >= raceTo has both players' scores. */
  const winningGameHasBothScores = useMemo(() => {
    if (singleWinnerName == null) return false;
    const forPlayer1 = singleWinnerName === player1Name;
    const raceTo = forPlayer1 ? player1RaceTo : player2RaceTo;
    const idx = getWinningGameIndex(player1Scores, player2Scores, raceTo, forPlayer1);
    if (idx == null) return false;
    const v1 = (player1Scores[idx] ?? "").trim();
    const v2 = (player2Scores[idx] ?? "").trim();
    return v1 !== "" && v2 !== "";
  }, [singleWinnerName, player1Name, player2Name, player1RaceTo, player2RaceTo, player1Scores, player2Scores]);

  const winningBallDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (readOnly) return;
    if (!winningGameHasBothScores) {
      if (winningBallDelayRef.current != null) {
        clearTimeout(winningBallDelayRef.current);
        winningBallDelayRef.current = null;
      }
      setLegalWinModalOpen(false);
      return;
    }
    if (dashboardOperator && !hasUserEditedScores) {
      if (winningBallDelayRef.current != null) {
        clearTimeout(winningBallDelayRef.current);
        winningBallDelayRef.current = null;
      }
      setLegalWinModalOpen(false);
      return;
    }
    if (singleWinnerName == null || legalWinConfirmed) return;
    winningBallDelayRef.current = setTimeout(() => {
      winningBallDelayRef.current = null;
      setLegalWinModalOpen(true);
    }, 3000);
    return () => {
      if (winningBallDelayRef.current != null) {
        clearTimeout(winningBallDelayRef.current);
        winningBallDelayRef.current = null;
      }
    };
  }, [
    singleWinnerName,
    legalWinConfirmed,
    winningGameHasBothScores,
    readOnly,
    dashboardOperator,
    hasUserEditedScores,
  ]);

  const handleScoreChange = useCallback(
    (playerIndex: 0 | 1, gameIndex: number, value: string) => {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly === "") {
        updateScore(playerIndex, gameIndex, "");
        return;
      }
      const num = parseInt(digitsOnly, 10);
      if (num > 10 || num === 8 || num === 9) {
        updateScore(playerIndex, gameIndex, "");
        return;
      }
      if (readOnly || totalsReached) {
        updateScore(playerIndex, gameIndex, digitsOnly);
        return;
      }
      updateScore(playerIndex, gameIndex, digitsOnly);
    },
    [totalsReached, updateScore, readOnly]
  );

  const handleScoreBlur = useCallback(
    (_gameIndex: number) => {
      if (totalsReached) return;
      /* Inline red labels show per-row errors; no modal. */
    },
    [totalsReached]
  );

  const { total1CellClass, total2CellClass } = useMemo(() => {
    const base =
      "border border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 px-3 py-2.5 text-center tabular-nums font-bold text-white";
    const winner = "text-yellow-400";
    const neutral = "text-white";
    if (p1Won) {
      return { total1CellClass: `${base} ${winner}`, total2CellClass: `${base} ${neutral}` };
    }
    if (p2Won) {
      return { total1CellClass: `${base} ${neutral}`, total2CellClass: `${base} ${winner}` };
    }
    return { total1CellClass: `${base} ${neutral}`, total2CellClass: `${base} ${neutral}` };
  }, [p1Won, p2Won]);

  /** Allow submit when one player has won (under strict rule if set), not both, and user confirmed legal win. */
  const canSubmitScores = useMemo(
    () =>
      totalsReached &&
      !bothHaveWinningTotals &&
      legalWinConfirmed &&
      (!dashboardOperator || hasUserEditedScores),
    [totalsReached, bothHaveWinningTotals, legalWinConfirmed, dashboardOperator, hasUserEditedScores]
  );

  const [submitSuccessModalOpen, setSubmitSuccessModalOpen] = useState(false);
  useEffect(() => {
    if (!submitSuccessModalOpen) return;
    const dest = dashboardOperator ? "/dashboard" : "/";
    const t = setTimeout(() => {
      setSubmitSuccessModalOpen(false);
      router.replace(dest);
    }, 3000);
    return () => clearTimeout(t);
  }, [submitSuccessModalOpen, router, dashboardOperator]);

  return (
    <div className="mx-auto max-w-2xl pb-8 mt-[5px]">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/50 pb-4">
          {(!validCard || !validMatch) ? (
            <p className="text-center text-sm text-amber-400/90">
              Invalid or missing card/match. Use the link from your bracket.
            </p>
          ) : (
            <>
              <header
                className="rounded-xl border border-white/10 bg-gradient-to-br from-[#020c1b] via-[#1e3a5f] to-[#020c1b] px-6 py-6 shadow-lg"
                aria-label="Matchup"
              >
                <div className="flex flex-wrap items-center justify-between gap-8 sm:gap-12">
                  <div className="min-w-0 flex-1 basis-0 text-center">
                    <p
                      className={
                        p1Won
                          ? "break-words text-sm font-semibold text-yellow-400 sm:text-base"
                          : "break-words text-sm font-semibold text-white sm:text-base"
                      }
                    >
                      {p1Won ? `${player1Name} Wins!!!` : player1Name}
                    </p>
                    <p className="mt-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-3xl font-medium tabular-nums text-transparent">
                      {player1RaceTo != null ? player1RaceTo : "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold uppercase tracking-widest text-slate-400">
                    vs
                  </p>
                  <div className="min-w-0 flex-1 basis-0 text-center">
                    <p
                      className={
                        p2Won
                          ? "break-words text-sm font-semibold text-yellow-400 sm:text-base"
                          : "break-words text-sm font-semibold text-white sm:text-base"
                      }
                    >
                      {p2Won ? `${player2Name} Wins!!!` : player2Name}
                    </p>
                    <p className="mt-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-3xl font-medium tabular-nums text-transparent">
                      {player2RaceTo != null ? player2RaceTo : "—"}
                    </p>
                  </div>
                </div>
              </header>
              <div className="mt-[5px] overflow-x-auto rounded-lg border border-slate-600">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-b from-slate-700 to-slate-800">
                      <th className="whitespace-nowrap border border-slate-600 px-3 py-2.5 text-center font-bold text-white">
                        Game #
                      </th>
                      <th
                        className={
                          p1Won
                            ? "border border-slate-600 px-3 py-2.5 text-center font-bold text-yellow-400"
                            : "border border-slate-600 px-3 py-2.5 text-center font-bold text-white"
                        }
                      >
                        {p1Won ? `${player1Name} Wins!!!` : player1Name}
                      </th>
                      <th
                        className={
                          p2Won
                            ? "border border-slate-600 px-3 py-2.5 text-center font-bold text-yellow-400"
                            : "border border-slate-600 px-3 py-2.5 text-center font-bold text-white"
                        }
                      >
                        {p2Won ? `${player2Name} Wins!!!` : player2Name}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-black">
                    {Array.from({ length: GAME_COUNT }, (_, i) => {
                      const hasAnyValue =
                        (player1Scores[i] ?? "").trim() !== "" || (player2Scores[i] ?? "").trim() !== "";
                      /** Hide trailing empty rows only after legal win is confirmed (Yes). If they answer No, keep blanks for extra games. */
                      if (totalsReached && legalWinConfirmed && !hasAnyValue) return null;
                      return (
                        <Fragment key={i}>
                          <tr>
                            <td className="whitespace-nowrap border border-slate-300 px-3 py-1.5 font-medium">
                              Game {i + 1}
                            </td>
                            <td className="border border-slate-300 p-0">
                              {readOnly ? (
                                <div className="w-full min-w-[2.5rem] bg-white px-2 py-1.5 text-center text-black">
                                  {player1Scores[i] || "—"}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={player1Scores[i]}
                                  onChange={(e) => handleScoreChange(0, i, e.target.value)}
                                  onBlur={() => handleScoreBlur(i)}
                                  disabled={
                                    totalsReached &&
                                    legalWinConfirmed &&
                                    (player1Scores[i] ?? "").trim() === ""
                                  }
                                  className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-[16px] text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-base"
                                  aria-label={`Game ${i + 1} ${player1Name}`}
                                />
                              )}
                            </td>
                            <td className="border border-slate-300 p-0">
                              {readOnly ? (
                                <div className="w-full min-w-[2.5rem] bg-white px-2 py-1.5 text-center text-black">
                                  {player2Scores[i] || "—"}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={player2Scores[i]}
                                  onChange={(e) => handleScoreChange(1, i, e.target.value)}
                                  onBlur={() => handleScoreBlur(i)}
                                  disabled={
                                    totalsReached &&
                                    legalWinConfirmed &&
                                    (player2Scores[i] ?? "").trim() === ""
                                  }
                                  className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-[16px] text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-base"
                                  aria-label={`Game ${i + 1} ${player2Name}`}
                                />
                              )}
                            </td>
                          </tr>
                          {(() => {
                            if (readOnly || (totalsReached && legalWinConfirmed)) return null;
                            const msg = getGameRowErrorMessage(player1Scores, player2Scores, i);
                            return msg ? (
                              <tr>
                                <td colSpan={3} className="border border-slate-300 bg-red-50 px-3 py-1.5 text-center text-sm font-medium text-red-600">
                                  Game {i + 1}: {msg}
                                </td>
                              </tr>
                            ) : null;
                          })()}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-b from-slate-700 to-slate-800">
                      <td className="whitespace-nowrap border border-slate-600 px-3 py-2.5 font-bold text-white">
                        Total
                      </td>
                      <td className={total1CellClass}>
                        {displayTotal1}
                      </td>
                      <td className={total2CellClass}>
                        {displayTotal2}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {!readOnly && bothHaveWinningTotals && (
                  <p className="w-full rounded-lg border border-amber-500/60 bg-amber-950/40 px-4 py-3 text-center text-sm font-medium text-amber-200" role="alert">
                    Both players can&apos;t have winning totals. Adjust the scores to represent who won first.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-3">
                  {!readOnly && totalsReached && !bothHaveWinningTotals && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canSubmitScores) return;
                        updateMatchStatus("Completed");
                        setSubmitSuccessModalOpen(true);
                      }}
                      disabled={!canSubmitScores}
                      className="rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-blue-600 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-blue-700 disabled:hover:to-blue-500"
                    >
                      Submit Scores
                    </button>
                  )}
                  {!readOnly &&
                    dashboardOperator &&
                    stage === "week1" &&
                    !(totalsReached && !bothHaveWinningTotals) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasUserEditedScores) return;
                        updateMatchStatus("Completed");
                        setSubmitSuccessModalOpen(true);
                      }}
                      disabled={!hasUserEditedScores}
                      className="rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-emerald-600 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-emerald-700 disabled:hover:to-emerald-500"
                      aria-label="Submit scores and mark matchup completed"
                    >
                      Submit scores
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(dashboardOperator ? "/dashboard" : "/")}
                    className="rounded-lg bg-gradient-to-r from-red-700 to-red-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-red-600 hover:to-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    aria-label={
                      dashboardOperator
                        ? "Exit live scoring and return to dashboard"
                        : "Exit live scoring and return home"
                    }
                  >
                    {readOnly ? "Back to Home" : "Exit"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {!readOnly ? <Modal
        open={legalWinModalOpen}
        onClose={() => setLegalWinModalOpen(false)}
        title="Confirm winning ball"
        hideCloseButton
        closeOnEscape={false}
        closeOnBackdropClick={false}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setLegalWinModalOpen(false);
                if (singleWinnerName === player1Name) setRequireStrictExceedPlayer1(true);
                else if (singleWinnerName === player2Name) setRequireStrictExceedPlayer2(true);
              }}
              className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => {
                setLegalWinConfirmed(true);
                setLegalWinModalOpen(false);
              }}
              className="cursor-pointer rounded-lg border border-emerald-400/50 bg-emerald-800/80 px-4 py-2.5 text-sm font-medium text-emerald-100 shadow-sm transition-colors hover:bg-emerald-700/80"
              aria-label="Yes, winning ball was legal"
            >
              Yes
            </button>
          </div>
        }
      >
        <p className="text-slate-200">
          Was the winning ball made legally by {singleWinnerName ?? "the winner"}?
        </p>
      </Modal> : null}
      {!readOnly ? <Modal
        open={submitSuccessModalOpen}
        onClose={() => {
          setSubmitSuccessModalOpen(false);
          router.replace(dashboardOperator ? "/dashboard" : "/");
        }}
        title="Success"
      >
        <p className="text-slate-200">
          Success, match scores successfully submitted.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {dashboardOperator ? "Redirecting to dashboard…" : "Redirecting to home…"}
        </p>
      </Modal> : null}
      </div>
  );
}
