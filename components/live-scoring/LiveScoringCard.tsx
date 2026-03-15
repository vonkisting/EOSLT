"use client";

import { useMemo, useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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

const ROW_ERROR_MESSAGE = "One player must have 10 each game.";

/** True iff this game row has both values and is invalid (both 10 or both < 10). */
function isGameRowInvalid(
  row1: string[],
  row2: string[],
  index: number
): boolean {
  const v1 = (row1[index] ?? "").trim();
  const v2 = (row2[index] ?? "").trim();
  if (v1 === "" || v2 === "") return false;
  const n1 = parseInt(v1, 10);
  const n2 = parseInt(v2, 10);
  return (n1 === 10 && n2 === 10) || (n1 !== 10 && n2 !== 10);
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

  const totalsReached = useMemo(
    () =>
      (player1RaceTo != null && total1 >= player1RaceTo) ||
      (player2RaceTo != null && total2 >= player2RaceTo),
    [player1RaceTo, player2RaceTo, total1, total2]
  );

  const handleScoreChange = useCallback(
    (playerIndex: 0 | 1, gameIndex: number, value: string) => {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly === "") {
        updateScore(playerIndex, gameIndex, "");
        return;
      }
      const num = parseInt(digitsOnly, 10);
      if (num > 10) {
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
    const p1Reached = player1RaceTo != null && total1 >= player1RaceTo;
    const p2Reached = player2RaceTo != null && total2 >= player2RaceTo;
    if (p1Reached) {
      return { total1CellClass: `${base} ${green}`, total2CellClass: `${base} ${pink}` };
    }
    if (p2Reached) {
      return { total1CellClass: `${base} ${pink}`, total2CellClass: `${base} ${green}` };
    }
    return { total1CellClass: `${base} ${neutral}`, total2CellClass: `${base} ${neutral}` };
  }, [player1RaceTo, player2RaceTo, total1, total2]);

  const canSubmitScores = useMemo(
    () => totalsReached && allGameRowsValid(player1Scores, player2Scores),
    [totalsReached, player1Scores, player2Scores]
  );

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/50 pb-8">
          {(!validCard || !validMatch) ? (
            <p className="text-center text-sm text-amber-400/90">
              Invalid or missing card/match. Use the link from your bracket.
            </p>
          ) : (
            <>
              <header
                className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-900/95 px-6 py-6 shadow-lg"
                aria-label="Matchup"
              >
                <div className="flex flex-wrap items-center justify-between gap-8 sm:gap-12">
                  <div className="min-w-0 flex-1 basis-0 text-center">
                    <p className="break-words text-sm font-semibold text-white sm:text-base">
                      {player1Name}
                    </p>
                    <p className="mt-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-3xl font-medium tabular-nums text-transparent">
                      {player1RaceTo != null ? player1RaceTo : "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold uppercase tracking-widest text-slate-400">
                    vs
                  </p>
                  <div className="min-w-0 flex-1 basis-0 text-center">
                    <p className="break-words text-sm font-semibold text-white sm:text-base">
                      {player2Name}
                    </p>
                    <p className="mt-1 bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-3xl font-medium tabular-nums text-transparent">
                      {player2RaceTo != null ? player2RaceTo : "—"}
                    </p>
                  </div>
                </div>
                {(player1RaceTo != null && total1 > player1RaceTo) ||
                (player2RaceTo != null && total2 > player2RaceTo) ? (
                  <div className="mt-4 flex w-full justify-center rounded bg-transparent px-3 py-2">
                    <p className="text-center text-2xl font-bold text-yellow-400">
                      {player1RaceTo != null &&
                      total1 > player1RaceTo &&
                      player2RaceTo != null &&
                      total2 > player2RaceTo
                        ? `${player1Name} & ${player2Name} Win!`
                        : player1RaceTo != null && total1 > player1RaceTo
                          ? `${player1Name} Wins!`
                          : `${player2Name} Wins!`}
                    </p>
                  </div>
                ) : null}
              </header>
              <div className="overflow-x-auto rounded-lg border border-slate-600 mt-6">
                <table className="w-full min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-b from-slate-700 to-slate-800">
                      <th className="whitespace-nowrap border border-slate-600 px-3 py-2.5 text-center font-bold text-white">
                        Game #
                      </th>
                      <th className="border border-slate-600 px-3 py-2.5 text-center font-bold text-white">
                        {player1Name}
                      </th>
                      <th className="border border-slate-600 px-3 py-2.5 text-center font-bold text-white">
                        {player2Name}
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
                        {isGameRowInvalid(player1Scores, player2Scores, i) && (
                          <tr>
                            <td colSpan={3} className="border border-slate-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">
                              Game {i + 1} {ROW_ERROR_MESSAGE}
                            </td>
                          </tr>
                        )}
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
              <hr className="my-6 border-slate-600" />
              <div className="flex justify-center gap-3">
                {canSubmitScores && (
                  <button
                    type="button"
                    onClick={() => {
                      updateMatchStatus("Completed");
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
            </>
          )}
        </div>
      </div>
      </div>
  );
}
