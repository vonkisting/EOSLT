"use client";

import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Modal } from "@/components/ui/Modal";
import { resolveWinnerNameForAdvancement } from "@/lib/bracketMatchAdvance";
import {
  parseFinalsBracketMatchStatusesJson,
  parseFinalsBracketScoresJson,
} from "@/lib/finalsBracketMatchStatuses";
import { liveScoreGamesGlobalKey } from "@/lib/liveScoringGlobalKey";
import { buildMatchCompletionPatch } from "@/lib/liveScoringMatchCompletionPatch";
import {
  displayNameWithForfeitSuffix,
  FINALS_MATCH_FORFEIT_COUNT,
  parseMatchForfeitsJson,
  WEEK1_MATCH_FORFEIT_COUNT,
  WEEK2_MATCH_FORFEIT_COUNT,
} from "@/lib/matchForfeitsJson";
import {
  buildMatchupResetPatch,
  emptyLiveScoreGamesJson,
} from "@/lib/liveScoringMatchupReset";
import {
  parseWeek2BracketMatchStatusesJson,
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
  week2SlotPairIndices,
} from "@/lib/week2BracketSlots";
import {
  bracketMatchStatusIsCompleted,
  bracketParticipantNamesMatch,
} from "@/lib/bracketNameMatch";
import { canAccessDashboard } from "@/lib/dashboard-access";

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
  index: number,
  options?: { hasPlayerReachedRaceTo?: boolean }
): string | null {
  const v1 = (row1[index] ?? "").trim();
  const v2 = (row2[index] ?? "").trim();
  if (v1 === "" || v2 === "") return null;
  const n1 = parseInt(v1, 10);
  const n2 = parseInt(v2, 10);
  if (n1 === 10 && n2 === 10) return "Only 1 player can score a 10 per game.";
  if (n1 !== 10 && n2 !== 10) {
    if (options?.hasPlayerReachedRaceTo) return null;
    return "One player MUST score a 10 each game.";
  }
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
  const isDashboardAdmin = canAccessDashboard(email);
  const convexUser = useQuery(api.users.getByEmail, email ? { email } : "skip");
  const settings = useQuery(api.dashboardSettings.getShared, {});
  const setDashboardSettings = useMutation(api.dashboardSettings.setShared);

  const tournamentStarted =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentStarted === true;
  const tournamentPaused =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentPaused === true;
  const tournamentInProgress = tournamentStarted && !tournamentPaused;

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

  const linkedPoolhubRaw = convexUser?.poolhubPlayerName?.trim() ?? "";
  const linkedPlayerInThisMatchup = useMemo(() => {
    if (!linkedPoolhubRaw) return false;
    if (player1Name === "—" && player2Name === "—") return false;
    return (
      bracketParticipantNamesMatch(player1Name, linkedPoolhubRaw) ||
      bracketParticipantNamesMatch(player2Name, linkedPoolhubRaw)
    );
  }, [linkedPoolhubRaw, player1Name, player2Name]);

  /** Spectator read-only from URL, unless this user is a linked player in this matchup. */
  const effectiveReadOnly = readOnly && !linkedPlayerInThisMatchup;
  /**
   * Operator controls: allowlisted dashboard admins always (any entry URL, any matchup, even if they are
   * a linked player in this match). Everyone else needs `?dashboard=1` and must not be the linked player
   * here (those users score as the linked entrant).
   */
  const effectiveDashboardOperator =
    isDashboardAdmin || (dashboardOperator && !linkedPlayerInThisMatchup);

  /** Stored bracket status for this matchup (shared settings). */
  const sharedMatchupStatusCompleted = useMemo(() => {
    if (!settings || typeof settings !== "object" || !validCard || !validMatch) return false;
    const s = settings as Record<string, unknown>;
    if (stage === "week1") {
      const raw = (s[`bracketMatchStatus${cardIndex * 6 + matchIndex}`] as string) ?? "";
      return bracketMatchStatusIsCompleted(raw);
    }
    if (stage === "week2") {
      const arr = parseWeek2BracketMatchStatusesJson(s.week2BracketMatchStatuses);
      const idx = cardIndex * 3 + matchIndex;
      return bracketMatchStatusIsCompleted(arr[idx] ?? "");
    }
    const arr = parseFinalsBracketMatchStatusesJson(s.finalsBracketMatchStatuses);
    return bracketMatchStatusIsCompleted(arr[matchIndex] ?? "");
  }, [settings, stage, cardIndex, matchIndex, validCard, validMatch]);

  useEffect(() => {
    if (settings === undefined) return;
    if (effectiveReadOnly) return;
    if (tournamentInProgress || effectiveDashboardOperator || linkedPlayerInThisMatchup) return;
    router.replace("/");
  }, [
    settings,
    tournamentInProgress,
    router,
    effectiveReadOnly,
    effectiveDashboardOperator,
    linkedPlayerInThisMatchup,
  ]);

  useEffect(() => {
    if (!validCard || !validMatch || !settings || typeof settings !== "object") return;
    const s = settings as Record<string, unknown>;
    const globalKey = liveScoreGamesGlobalKey(stage, cardIndex, matchIndex);
    const raw = s[`liveScoreGames${globalKey}`];
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
          if (effectiveDashboardOperator) {
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
    if (!email || effectiveReadOnly) return;
    const emptyGames = emptyLiveScoreGamesJson();
    lastSyncedRawRef.current = emptyGames;
    if (effectiveDashboardOperator) {
      baselineSnapshotRef.current = { p1: [...EMPTY_ROW], p2: [...EMPTY_ROW] };
    }
    setPlayer1Scores([...EMPTY_ROW]);
    setPlayer2Scores([...EMPTY_ROW]);

    const patch: Record<string, unknown> = {
      email: email as string,
      leagueName: String(s.leagueName ?? ""),
      season: String(s.season ?? ""),
      [`liveScoreGames${globalKey}`]: emptyGames,
    };

    if (stage === "week1") {
      patch[`bracketScoreTop${globalKey}`] = "0";
      patch[`bracketScoreBottom${globalKey}`] = "0";
    } else if (stage === "week2") {
      const scores = parseWeek2BracketScoresJson(s.week2BracketScores);
      const next = [...scores];
      const base = cardIndex * 6;
      const si = base + matchIndex * 2;
      next[si] = "0";
      next[si + 1] = "0";
      patch.week2BracketScores = JSON.stringify(next);
    } else {
      const scores = parseFinalsBracketScoresJson(s.finalsBracketScores);
      const next = [...scores];
      next[matchIndex * 2] = "0";
      next[matchIndex * 2 + 1] = "0";
      patch.finalsBracketScores = JSON.stringify(next);
    }

    setDashboardSettings(patch as Parameters<typeof setDashboardSettings>[0]);
  }, [
    settings,
    cardIndex,
    matchIndex,
    validCard,
    validMatch,
    email,
    setDashboardSettings,
    stage,
    effectiveReadOnly,
    effectiveDashboardOperator,
  ]);

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
      effectiveReadOnly ||
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
    const globalKey = liveScoreGamesGlobalKey(stage, cardIndex, matchIndex);
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
      const patch: Record<string, unknown> = {
        email: email as string,
        leagueName: String(s.leagueName ?? ""),
        season: String(s.season ?? ""),
        [`liveScoreGames${globalKey}`]: payload,
      };
      if (stage === "week1") {
        patch[`bracketScoreTop${globalKey}`] = String(totals.total1);
        patch[`bracketScoreBottom${globalKey}`] = String(totals.total2);
      } else if (stage === "week2") {
        const scores = parseWeek2BracketScoresJson(s.week2BracketScores);
        const next = [...scores];
        const base = cardIndex * 6;
        const si = base + matchIndex * 2;
        next[si] = String(totals.total1);
        next[si + 1] = String(totals.total2);
        patch.week2BracketScores = JSON.stringify(next);
      } else {
        const scores = parseFinalsBracketScoresJson(s.finalsBracketScores);
        const next = [...scores];
        next[matchIndex * 2] = String(totals.total1);
        next[matchIndex * 2 + 1] = String(totals.total2);
        patch.finalsBracketScores = JSON.stringify(next);
      }
      setDashboardSettings(patch as Parameters<typeof setDashboardSettings>[0]);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [email, settings, validCard, validMatch, cardIndex, matchIndex, player1Scores, player2Scores, setDashboardSettings, effectiveReadOnly, stage]);

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
  const displayTotal1 = effectiveReadOnly ? Number.parseInt(storedTopScore, 10) || 0 : total1;
  const displayTotal2 = effectiveReadOnly ? Number.parseInt(storedBottomScore, 10) || 0 : total2;

  /** Dashboard: submit only after the user changes at least one cell vs loaded snapshot. */
  const hasUserEditedScores = useMemo(() => {
    if (!effectiveDashboardOperator || effectiveReadOnly) return true;
    const b = baselineSnapshotRef.current;
    if (b == null) return false;
    return !scoresEqualToBaseline(player1Scores, player2Scores, b);
  }, [effectiveDashboardOperator, effectiveReadOnly, player1Scores, player2Scores]);

  const [legalWinConfirmed, setLegalWinConfirmed] = useState(false);
  const [requireStrictExceedPlayer1, setRequireStrictExceedPlayer1] = useState(false);
  const [requireStrictExceedPlayer2, setRequireStrictExceedPlayer2] = useState(false);
  const [legalWinModalOpen, setLegalWinModalOpen] = useState(false);

  /** Completed matches skip the winning-ball modal; same effect as legal confirmation for submit/rows. */
  const legalWinSatisfied = legalWinConfirmed || sharedMatchupStatusCompleted;

  useEffect(() => {
    if (effectiveReadOnly) return;
    if (sharedMatchupStatusCompleted) return;
    setLegalWinConfirmed(false);
  }, [total1, total2, effectiveReadOnly, sharedMatchupStatusCompleted]);

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

  useEffect(() => {
    if (effectiveReadOnly || !effectiveDashboardOperator) return;
    if (sharedMatchupStatusCompleted) return;
    if (hasUserEditedScores) return;
    if (totalsReached && !bothHaveWinningTotals) return;
    setLegalWinConfirmed(false);
    setLegalWinModalOpen(false);
    setRequireStrictExceedPlayer1(false);
    setRequireStrictExceedPlayer2(false);
  }, [
    hasUserEditedScores,
    effectiveReadOnly,
    effectiveDashboardOperator,
    totalsReached,
    bothHaveWinningTotals,
    sharedMatchupStatusCompleted,
  ]);

  const forfeitingPlayerForThisMatch = useMemo(() => {
    if (!settings || typeof settings !== "object" || !validCard || !validMatch) return null;
    const s = settings as Record<string, unknown>;
    if (stage === "week1") {
      const arr = parseMatchForfeitsJson(s.week1MatchForfeits, WEEK1_MATCH_FORFEIT_COUNT);
      const v = arr[cardIndex * 6 + matchIndex]?.trim() ?? "";
      return v || null;
    }
    if (stage === "week2") {
      const arr = parseMatchForfeitsJson(s.week2MatchForfeits, WEEK2_MATCH_FORFEIT_COUNT);
      const v = arr[cardIndex * 3 + matchIndex]?.trim() ?? "";
      return v || null;
    }
    const arr = parseMatchForfeitsJson(s.finalsMatchForfeits, FINALS_MATCH_FORFEIT_COUNT);
    const v = arr[matchIndex]?.trim() ?? "";
    return v || null;
  }, [settings, stage, cardIndex, matchIndex, validCard, validMatch]);

  const player1DisplayName = useMemo(
    () => displayNameWithForfeitSuffix(player1Name, forfeitingPlayerForThisMatch) || player1Name,
    [player1Name, forfeitingPlayerForThisMatch]
  );
  const player2DisplayName = useMemo(
    () => displayNameWithForfeitSuffix(player2Name, forfeitingPlayerForThisMatch) || player2Name,
    [player2Name, forfeitingPlayerForThisMatch]
  );

  const updateMatchStatus = useCallback(
    (
      status: string,
      opts?: { forcedWinnerName?: string | null; forfeitingPlayerName?: string | null }
    ) => {
      if (effectiveReadOnly || !email || !settings || typeof settings !== "object" || !validCard || !validMatch) {
        return;
      }
      if (status !== "Completed") return;
      const s = settings as Record<string, unknown>;
      const forced = opts?.forcedWinnerName?.trim() ?? "";
      const winner =
        forced !== ""
          ? forced
          : resolveWinnerNameForAdvancement(
              singleWinnerName,
              player1Name,
              player2Name,
              displayTotal1,
              displayTotal2
            );

      const forfeitFlow = (opts?.forfeitingPlayerName?.trim() ?? "") !== "";
      const { total1: submitTotal1, total2: submitTotal2 } = sumScoresWhenBothPresent(
        player1Scores,
        player2Scores
      );
      const completionPatch = buildMatchCompletionPatch(stage, cardIndex, matchIndex, s, winner, {
        forfeitingPlayerName: opts?.forfeitingPlayerName ?? null,
        ...(!forfeitFlow
          ? {
              finalScorecard: {
                liveGamesJson: JSON.stringify({ p1: player1Scores, p2: player2Scores }),
                total1: submitTotal1,
                total2: submitTotal2,
              },
            }
          : {}),
      });
      setDashboardSettings({
        email,
        leagueName: String(s.leagueName ?? ""),
        season: String(s.season ?? ""),
        tournamentStarted: s.tournamentStarted === true,
        tournamentPaused: s.tournamentPaused === true,
        ...completionPatch,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [
      email,
      settings,
      validCard,
      validMatch,
      cardIndex,
      matchIndex,
      setDashboardSettings,
      effectiveReadOnly,
      stage,
      singleWinnerName,
      player1Name,
      player2Name,
      displayTotal1,
      displayTotal2,
      player1Scores,
      player2Scores,
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
    if (effectiveReadOnly) return;
    if (sharedMatchupStatusCompleted) {
      if (winningBallDelayRef.current != null) {
        clearTimeout(winningBallDelayRef.current);
        winningBallDelayRef.current = null;
      }
      setLegalWinModalOpen(false);
      return;
    }
    if (!winningGameHasBothScores) {
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
    effectiveReadOnly,
    sharedMatchupStatusCompleted,
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
      if (effectiveReadOnly || totalsReached) {
        updateScore(playerIndex, gameIndex, digitsOnly);
        return;
      }
      updateScore(playerIndex, gameIndex, digitsOnly);
    },
    [totalsReached, updateScore, effectiveReadOnly]
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
  const canSubmitScores = useMemo(() => {
    const operatorMaySubmit =
      !effectiveDashboardOperator ||
      hasUserEditedScores ||
      (totalsReached && !bothHaveWinningTotals);
    return (
      totalsReached &&
      !bothHaveWinningTotals &&
      legalWinSatisfied &&
      operatorMaySubmit
    );
  }, [
    totalsReached,
    bothHaveWinningTotals,
    legalWinSatisfied,
    effectiveDashboardOperator,
    hasUserEditedScores,
  ]);

  const [submitSuccessModalOpen, setSubmitSuccessModalOpen] = useState(false);
  const [resetMatchupModalOpen, setResetMatchupModalOpen] = useState(false);
  const [forfeitModalOpen, setForfeitModalOpen] = useState(false);

  const canForfeitMatch =
    isDashboardAdmin &&
    effectiveDashboardOperator &&
    !effectiveReadOnly &&
    !sharedMatchupStatusCompleted &&
    player1Name.trim() !== "" &&
    player1Name !== "—" &&
    player2Name.trim() !== "" &&
    player2Name !== "—";

  const confirmResetMatchup = useCallback(() => {
    if (
      !isDashboardAdmin ||
      !email ||
      !settings ||
      typeof settings !== "object" ||
      !validCard ||
      !validMatch
    ) {
      return;
    }
    const s = settings as Record<string, unknown>;
    const emptyGames = emptyLiveScoreGamesJson();
    const resetPatch = buildMatchupResetPatch(stage, cardIndex, matchIndex, s);
    lastSyncedRawRef.current = emptyGames;
    lastWrittenRawRef.current = emptyGames;
    skipNextSaveRef.current = true;
    if (isDashboardAdmin) {
      baselineSnapshotRef.current = { p1: [...EMPTY_ROW], p2: [...EMPTY_ROW] };
    }
    setPlayer1Scores([...EMPTY_ROW]);
    setPlayer2Scores([...EMPTY_ROW]);
    setLegalWinConfirmed(false);
    setLegalWinModalOpen(false);
    setRequireStrictExceedPlayer1(false);
    setRequireStrictExceedPlayer2(false);
    setResetMatchupModalOpen(false);
    setDashboardSettings({
      email,
      leagueName: String(s.leagueName ?? ""),
      season: String(s.season ?? ""),
      tournamentStarted: s.tournamentStarted === true,
      tournamentPaused: s.tournamentPaused === true,
      ...resetPatch,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [
    isDashboardAdmin,
    email,
    settings,
    validCard,
    validMatch,
    stage,
    cardIndex,
    matchIndex,
    setDashboardSettings,
  ]);

  const confirmForfeit = useCallback(
    (forfeitingIsPlayer1: boolean) => {
      if (
        !canForfeitMatch ||
        !validCard ||
        !validMatch ||
        !email ||
        !settings ||
        typeof settings !== "object"
      ) {
        setForfeitModalOpen(false);
        return;
      }
      const winnerName = forfeitingIsPlayer1 ? player2Name : player1Name;
      const emptyGames = emptyLiveScoreGamesJson();
      lastSyncedRawRef.current = emptyGames;
      lastWrittenRawRef.current = emptyGames;
      skipNextSaveRef.current = true;
      baselineSnapshotRef.current = { p1: [...EMPTY_ROW], p2: [...EMPTY_ROW] };
      setPlayer1Scores([...EMPTY_ROW]);
      setPlayer2Scores([...EMPTY_ROW]);
      setLegalWinConfirmed(false);
      setLegalWinModalOpen(false);
      setRequireStrictExceedPlayer1(false);
      setRequireStrictExceedPlayer2(false);
      setForfeitModalOpen(false);
      const forfeitingName = forfeitingIsPlayer1 ? player1Name : player2Name;
      updateMatchStatus("Completed", {
        forcedWinnerName: winnerName,
        forfeitingPlayerName: forfeitingName,
      });
      setSubmitSuccessModalOpen(true);
    },
    [
      canForfeitMatch,
      validCard,
      validMatch,
      email,
      settings,
      player1Name,
      player2Name,
      updateMatchStatus,
    ]
  );

  useEffect(() => {
    if (!submitSuccessModalOpen) return;
    const dest = effectiveDashboardOperator ? "/dashboard" : "/";
    const t = setTimeout(() => {
      setSubmitSuccessModalOpen(false);
      router.replace(dest);
    }, 3000);
    return () => clearTimeout(t);
  }, [submitSuccessModalOpen, router, effectiveDashboardOperator]);

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
                      {p1Won ? `${player1DisplayName} Wins!!!` : player1DisplayName}
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
                      {p2Won ? `${player2DisplayName} Wins!!!` : player2DisplayName}
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
                        {p1Won ? `${player1DisplayName} Wins!!!` : player1DisplayName}
                      </th>
                      <th
                        className={
                          p2Won
                            ? "border border-slate-600 px-3 py-2.5 text-center font-bold text-yellow-400"
                            : "border border-slate-600 px-3 py-2.5 text-center font-bold text-white"
                        }
                      >
                        {p2Won ? `${player2DisplayName} Wins!!!` : player2DisplayName}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-black">
                    {Array.from({ length: GAME_COUNT }, (_, i) => {
                      const hasAnyValue =
                        (player1Scores[i] ?? "").trim() !== "" || (player2Scores[i] ?? "").trim() !== "";
                      /** Hide trailing empty rows only after legal win is confirmed (Yes). If they answer No, keep blanks for extra games. */
                      if (totalsReached && legalWinSatisfied && !hasAnyValue) return null;
                      return (
                        <Fragment key={i}>
                          <tr>
                            <td className="whitespace-nowrap border border-slate-300 px-3 py-1.5 font-medium">
                              Game {i + 1}
                            </td>
                            <td className="border border-slate-300 p-0">
                              {effectiveReadOnly ? (
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
                                    legalWinSatisfied &&
                                    (player1Scores[i] ?? "").trim() === ""
                                  }
                                  className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-[16px] text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-base"
                                  aria-label={`Game ${i + 1} ${player1DisplayName}`}
                                />
                              )}
                            </td>
                            <td className="border border-slate-300 p-0">
                              {effectiveReadOnly ? (
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
                                    legalWinSatisfied &&
                                    (player2Scores[i] ?? "").trim() === ""
                                  }
                                  className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-[16px] text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-base"
                                  aria-label={`Game ${i + 1} ${player2DisplayName}`}
                                />
                              )}
                            </td>
                          </tr>
                          {(() => {
                            if (effectiveReadOnly || (totalsReached && legalWinSatisfied)) return null;
                            const msg = getGameRowErrorMessage(player1Scores, player2Scores, i, {
                              hasPlayerReachedRaceTo: totalsReached,
                            });
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
                {!effectiveReadOnly && bothHaveWinningTotals && (
                  <p className="w-full rounded-lg border border-amber-500/60 bg-amber-950/40 px-4 py-3 text-center text-sm font-medium text-amber-200" role="alert">
                    Both players can&apos;t have winning totals. Adjust the scores to represent who won first.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-3">
                  {isDashboardAdmin && (
                    <button
                      type="button"
                      onClick={() => setResetMatchupModalOpen(true)}
                      className="rounded-lg border border-amber-500/70 bg-amber-950/40 px-5 py-2.5 font-semibold text-amber-100 shadow transition-colors hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    >
                      Reset Matchup
                    </button>
                  )}
                  {canForfeitMatch && (
                    <button
                      type="button"
                      onClick={() => setForfeitModalOpen(true)}
                      className="rounded-lg border border-orange-500/70 bg-orange-950/40 px-5 py-2.5 font-semibold text-orange-100 shadow transition-colors hover:bg-orange-900/50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    >
                      Forfeit
                    </button>
                  )}
                  {effectiveReadOnly && isDashboardAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(
                          `/live-scoring?stage=${stage}&card=${cardIndex}&match=${matchIndex}&dashboard=1`
                        );
                      }}
                      className="rounded-lg bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-emerald-600 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    >
                      Live Score Match
                    </button>
                  )}
                  {!effectiveReadOnly && effectiveDashboardOperator && totalsReached && !bothHaveWinningTotals && (
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
                  {!effectiveReadOnly && !effectiveDashboardOperator && totalsReached && !bothHaveWinningTotals && (
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
                  <button
                    type="button"
                    onClick={() => router.push(effectiveDashboardOperator ? "/dashboard" : "/")}
                    className="rounded-lg bg-gradient-to-r from-red-700 to-red-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-red-600 hover:to-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    aria-label={
                      effectiveDashboardOperator
                        ? "Exit live scoring and return to dashboard"
                        : "Exit live scoring and return home"
                    }
                  >
                    {effectiveReadOnly ? "Back to Home" : "Exit"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {isDashboardAdmin ? (
        <Modal
          open={resetMatchupModalOpen}
          onClose={() => setResetMatchupModalOpen(false)}
          title="Reset matchup"
          footer={
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetMatchupModalOpen(false)}
                className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmResetMatchup()}
                className="cursor-pointer rounded-lg border border-amber-500/50 bg-amber-900/80 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-sm transition-colors hover:bg-amber-800/80"
              >
                Reset
              </button>
            </div>
          }
        >
          <p className="text-slate-200">
            This clears all game scores and totals for this matchup and sets its status to the default
            (empty). If a winner had been advanced to the next round on this card, Week 2, or Finals, that
            advanced name is cleared so the slot shows as empty (Select Player). Other unrelated matchups are
            not changed.
          </p>
        </Modal>
      ) : null}
      {isDashboardAdmin ? (
        <Modal
          open={forfeitModalOpen}
          onClose={() => setForfeitModalOpen(false)}
          title="Forfeit match"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setForfeitModalOpen(false)}
                className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmForfeit(true)}
                className="cursor-pointer rounded-lg border border-orange-500/50 bg-orange-900/80 px-4 py-2.5 text-sm font-medium text-orange-100 shadow-sm transition-colors hover:bg-orange-800/80"
              >
                <span className="block max-w-full break-words text-left sm:max-w-[min(100vw-4rem,320px)]">
                  {player1Name} forfeited
                </span>
              </button>
              <button
                type="button"
                onClick={() => confirmForfeit(false)}
                className="cursor-pointer rounded-lg border border-orange-500/50 bg-orange-900/80 px-4 py-2.5 text-sm font-medium text-orange-100 shadow-sm transition-colors hover:bg-orange-800/80"
              >
                <span className="block max-w-full break-words text-left sm:max-w-[min(100vw-4rem,320px)]">
                  {player2Name} forfeited
                </span>
              </button>
            </div>
          }
        >
          <p className="text-slate-200">
            The scorecard will be submitted as 0–0. The other player will be advanced to the next round
            (or Week 2 / Finals when this matchup feeds forward). Choose who forfeited.
          </p>
        </Modal>
      ) : null}
      {!effectiveReadOnly ? <Modal
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
      {!effectiveReadOnly ? <Modal
        open={submitSuccessModalOpen}
        onClose={() => {
          setSubmitSuccessModalOpen(false);
          router.replace(effectiveDashboardOperator ? "/dashboard" : "/");
        }}
        title="Scorecard Successfully Submitted"
      >
        <div className="space-y-4">
          <div
            className="h-px w-full bg-white/15"
            role="separator"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-400">
            {effectiveDashboardOperator ? "Redirecting to dashboard…" : "Redirecting to home…"}
          </p>
        </div>
      </Modal> : null}
      </div>
  );
}
