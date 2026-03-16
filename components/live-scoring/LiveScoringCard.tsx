"use client";

import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Modal } from "@/components/ui/Modal";

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
}: {
  cardIndex: number;
  matchIndex: number;
}) {
  const validCard = cardIndex >= 0 && cardIndex <= 7;
  const validMatch = matchIndex >= 0 && matchIndex <= 5;

  const router = useRouter();
  const email = useSession().data?.user?.email?.toLowerCase().trim();
  const settings = useQuery(
    api.dashboardSettings.get,
    email ? { email } : "skip"
  );
  const setDashboardSettings = useMutation(api.dashboardSettings.set);

  const tournamentStarted =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentStarted === true;
  const tournamentPaused =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentPaused === true;
  const tournamentInProgress = tournamentStarted && !tournamentPaused;

  useEffect(() => {
    if (settings === undefined) return;
    if (!tournamentInProgress) router.replace("/");
  }, [settings, tournamentInProgress, router]);

  const [player1Scores, setPlayer1Scores] = useState<string[]>(() => [...EMPTY_ROW]);
  const [player2Scores, setPlayer2Scores] = useState<string[]>(() => [...EMPTY_ROW]);
  /** Last raw JSON we synced from Convex for this card/match so we only update state when Convex value actually changes (real-time sync across clients). */
  const lastSyncedRawRef = useRef<string | null>(null);
  /** When true, the next save effect run should skip writing (state was just set from a remote sync to avoid ping-pong). */
  const skipNextSaveRef = useRef(false);
  /** Last raw we wrote to Convex; skip applying it when it comes back so we don't re-render from our own echo. */
  const lastWrittenRawRef = useRef<string | null>(null);

  useEffect(() => {
    lastSyncedRawRef.current = null;
    lastWrittenRawRef.current = null;
  }, [cardIndex, matchIndex]);

  useEffect(() => {
    if (!validCard || !validMatch || !settings || typeof settings !== "object") return;
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
          setPlayer1Scores(p1);
          setPlayer2Scores(p2);
        }
      } catch {
        lastSyncedRawRef.current = null;
      }
      return;
    }
    if (!email) return;
    const emptyGames = JSON.stringify({
      p1: Array.from({ length: GAME_COUNT }, () => ""),
      p2: Array.from({ length: GAME_COUNT }, () => ""),
    });
    lastSyncedRawRef.current = emptyGames;
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
  }, [settings, cardIndex, matchIndex, validCard, validMatch, email, setDashboardSettings]);

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
    if (!email || !settings || typeof settings !== "object" || !validCard || !validMatch) return;
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
  }, [email, settings, validCard, validMatch, cardIndex, matchIndex, player1Scores, player2Scores, setDashboardSettings]);

  const updateMatchStatus = useCallback(
    (status: string) => {
      if (!email || !settings || typeof settings !== "object" || !validCard || !validMatch) return;
      const s = settings as Record<string, unknown>;
      const statusKey = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
      setDashboardSettings({
        email,
        leagueName: String(s.leagueName ?? ""),
        season: String(s.season ?? ""),
        tournamentStarted: s.tournamentStarted === true,
        tournamentPaused: s.tournamentPaused === true,
        [statusKey]: status,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, settings, validCard, validMatch, cardIndex, matchIndex, setDashboardSettings]
  );

  const { player1Name, player2Name } = useMemo(() => {
    const s = settings as Record<string, unknown> | undefined;
    if (s == null || !validCard || !validMatch) {
      return { player1Name: "—", player2Name: "—" };
    }
    const base = cardIndex * 12;
    const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
    const p1 = (s[`bracketSlot${base + topSlot}`] as string) ?? "";
    const p2 = (s[`bracketSlot${base + bottomSlot}`] as string) ?? "";
    return {
      player1Name: (p1 || "").trim() || "—",
      player2Name: (p2 || "").trim() || "—",
    };
  }, [settings, cardIndex, matchIndex, validCard, validMatch]);

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

  const [legalWinConfirmed, setLegalWinConfirmed] = useState(false);
  const [requireStrictExceedPlayer1, setRequireStrictExceedPlayer1] = useState(false);
  const [requireStrictExceedPlayer2, setRequireStrictExceedPlayer2] = useState(false);
  const [legalWinModalOpen, setLegalWinModalOpen] = useState(false);

  useEffect(() => {
    setLegalWinConfirmed(false);
  }, [total1, total2]);

  const p1Won = useMemo(
    () =>
      player1RaceTo != null &&
      (requireStrictExceedPlayer1 ? total1 > player1RaceTo : total1 >= player1RaceTo),
    [player1RaceTo, total1, requireStrictExceedPlayer1]
  );
  const p2Won = useMemo(
    () =>
      player2RaceTo != null &&
      (requireStrictExceedPlayer2 ? total2 > player2RaceTo : total2 >= player2RaceTo),
    [player2RaceTo, total2, requireStrictExceedPlayer2]
  );

  const totalsReached = useMemo(() => p1Won || p2Won, [p1Won, p2Won]);
  const bothHaveWinningTotals = useMemo(() => p1Won && p2Won, [p1Won, p2Won]);
  const singleWinnerName = useMemo(
    () => (p1Won && !p2Won ? player1Name : p2Won && !p1Won ? player2Name : null),
    [p1Won, p2Won, player1Name, player2Name]
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
  }, [singleWinnerName, legalWinConfirmed, winningGameHasBothScores]);

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
      if (totalsReached) {
        updateScore(playerIndex, gameIndex, digitsOnly);
        return;
      }
      updateScore(playerIndex, gameIndex, digitsOnly);
    },
    [totalsReached, updateScore]
  );

  const handleScoreBlur = useCallback(
    (_gameIndex: number) => {
      if (totalsReached) return;
      /* Inline red labels show per-row errors; no modal. */
    },
    [totalsReached]
  );

  const { total1CellClass, total2CellClass } = useMemo(() => {
    const base = "border border-slate-300 px-3 py-1.5 text-center tabular-nums";
    const green = "bg-green-500 text-white font-semibold";
    const pink = "bg-pink-500 text-white font-semibold";
    const neutral = "font-semibold text-black";
    if (p1Won) {
      return { total1CellClass: `${base} ${green}`, total2CellClass: `${base} ${pink}` };
    }
    if (p2Won) {
      return { total1CellClass: `${base} ${pink}`, total2CellClass: `${base} ${green}` };
    }
    return { total1CellClass: `${base} ${neutral}`, total2CellClass: `${base} ${neutral}` };
  }, [p1Won, p2Won]);

  /** Allow submit when one player has won (under strict rule if set), not both, and user confirmed legal win. */
  const canSubmitScores = useMemo(
    () => totalsReached && !bothHaveWinningTotals && legalWinConfirmed,
    [totalsReached, bothHaveWinningTotals, legalWinConfirmed]
  );

  const [submitSuccessModalOpen, setSubmitSuccessModalOpen] = useState(false);
  useEffect(() => {
    if (!submitSuccessModalOpen) return;
    const t = setTimeout(() => {
      setSubmitSuccessModalOpen(false);
      router.replace("/");
    }, 3000);
    return () => clearTimeout(t);
  }, [submitSuccessModalOpen, router]);

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
                    {Array.from({ length: GAME_COUNT }, (_, i) => (
                      <Fragment key={i}>
                        <tr>
                          <td className="whitespace-nowrap border border-slate-300 px-3 py-1.5 font-medium">
                            Game {i + 1}
                          </td>
                          <td className="border border-slate-300 p-0">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={player1Scores[i]}
                              onChange={(e) => handleScoreChange(0, i, e.target.value)}
                              onBlur={() => handleScoreBlur(i)}
                              disabled={totalsReached && (player1Scores[i] ?? "").trim() === ""}
                              className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                              aria-label={`Game ${i + 1} ${player1Name}`}
                            />
                          </td>
                          <td className="border border-slate-300 p-0">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={player2Scores[i]}
                              onChange={(e) => handleScoreChange(1, i, e.target.value)}
                              onBlur={() => handleScoreBlur(i)}
                              disabled={totalsReached && (player2Scores[i] ?? "").trim() === ""}
                              className="w-full min-w-[2.5rem] border-0 bg-white px-2 py-1.5 text-center text-black outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                              aria-label={`Game ${i + 1} ${player2Name}`}
                            />
                          </td>
                        </tr>
                        {(() => {
                          if (totalsReached) return null;
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
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 text-black">
                      <td className="whitespace-nowrap border border-slate-300 px-3 py-1.5 font-semibold">
                        Total
                      </td>
                      <td className={total1CellClass}>
                        {total1}
                      </td>
                      <td className={total2CellClass}>
                        {total2}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {bothHaveWinningTotals && (
                  <p className="w-full rounded-lg border border-amber-500/60 bg-amber-950/40 px-4 py-3 text-center text-sm font-medium text-amber-200" role="alert">
                    Both players can&apos;t have winning totals. Adjust the scores to represent who won first.
                  </p>
                )}
                <div className="flex justify-center gap-3">
                  {canSubmitScores && (
                    <button
                      type="button"
                      onClick={() => {
                        updateMatchStatus("Completed");
                        setSubmitSuccessModalOpen(true);
                      }}
                      className="rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-blue-600 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                    >
                      Submit Scores
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      updateMatchStatus("Paused");
                      router.push("/");
                    }}
                    className="rounded-lg bg-gradient-to-r from-red-700 to-red-500 px-5 py-2.5 font-semibold text-white shadow transition-opacity hover:from-red-600 hover:to-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                  >
                    Pause Match
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        open={legalWinModalOpen}
        onClose={() => setLegalWinModalOpen(false)}
        title="Confirm winning ball"
      >
        <p className="mb-6 text-slate-200">
          Was the winning ball made legally by {singleWinnerName ?? "the winner"}?
        </p>
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
      </Modal>
      <Modal
        open={submitSuccessModalOpen}
        onClose={() => {
          setSubmitSuccessModalOpen(false);
          router.replace("/");
        }}
        title="Success"
      >
        <p className="text-slate-200">
          Success, match scores successfully submitted.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Redirecting to home…
        </p>
      </Modal>
      </div>
  );
}
