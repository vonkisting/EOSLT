"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bracket8TwoRounds } from "@/components/Bracket8TwoRounds";

const PLAYER_SLOTS = 64;
const BYE_LABEL = "-- Bye --";

const WEEK_1_LOCATION_KEYS = [
  "firstWeekLocation1",
  "firstWeekLocation2",
  "firstWeekLocation3",
  "firstWeekLocation4",
  "firstWeekLocation5",
  "firstWeekLocation6",
  "firstWeekLocation7",
  "firstWeekLocation8",
] as const;

type OverallPlayerStatsRow = Record<string, string | number | null | undefined>;

function getStatValue(
  row: OverallPlayerStatsRow,
  ...keys: string[]
): string | number | null | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
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

/**
 * Home page bracket cards when the user has League Name and Season saved in Convex.
 * Shows the same 8 Week 1 tournament bracket cards as the dashboard (read-only).
 */
/** Slot indices for a matchup: matchIndex 0->0,1; 1->2,3; ...; 5->10,11. */
function slotIndicesForMatch(matchIndex: number): [number, number] {
  const top = matchIndex < 4 ? matchIndex * 2 : 8 + (matchIndex - 4) * 2;
  return [top, top + 1];
}

export function HomeBracketCards() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email?.toLowerCase().trim();
  const settings = useQuery(
    api.dashboardSettings.get,
    email ? { email } : "skip"
  );
  const setDashboardSettings = useMutation(api.dashboardSettings.set);
  const convexUser = useQuery(
    api.users.getByEmail,
    email ? { email } : "skip"
  );

  const [leagueGuid, setLeagueGuid] = useState<string | null>(null);

  const linkedName = (convexUser?.poolhubPlayerName ?? "").trim().toLowerCase();
  const [playerRows, setPlayerRows] = useState<
    { playerName: string; raceTo: number | null }[]
  >([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "loading" && settings !== undefined) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [status, settings]);

  const hasLeagueAndSeason =
    settings &&
    typeof settings === "object" &&
    (settings as Record<string, unknown>).leagueName &&
    (settings as Record<string, unknown>).season;

  const tournamentStarted =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentStarted === true;
  const tournamentPaused =
    settings && typeof settings === "object" && (settings as Record<string, unknown>).tournamentPaused === true;
  const tournamentInProgress = tournamentStarted && !tournamentPaused;

  const resolveLeagueGuid = useCallback(
    async (leagueName: string, season: string) => {
      const res = await fetch(
        `/api/players?leagueName=${encodeURIComponent(leagueName)}&season=${encodeURIComponent(season)}`
      );
      const data = await res.json();
      return data?.leagueGuid ?? null;
    },
    []
  );

  useEffect(() => {
    if (!hasLeagueAndSeason) {
      setLeagueGuid(null);
      setPlayerRows([]);
      return;
    }
    const s = settings as Record<string, unknown>;
    const guid = s.leagueGuid as string | null | undefined;
    if (guid) {
      setLeagueGuid(guid);
      return;
    }
    const leagueName = s.leagueName as string;
    const season = s.season as string;
    if (!leagueName || !season) return;
    let cancelled = false;
    resolveLeagueGuid(leagueName, season).then((resolved) => {
      if (!cancelled) setLeagueGuid(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [hasLeagueAndSeason, settings, resolveLeagueGuid]);

  useEffect(() => {
    if (!leagueGuid) {
      setPlayerRows([]);
      return;
    }
    let cancelled = false;
    setLoadingPlayers(true);
    fetch(`/api/overall-player-stats?leagueGuid=${encodeURIComponent(leagueGuid)}`)
      .then((r) => r.json())
      .then((data: OverallPlayerStatsRow[]) => {
        if (cancelled) return;
        const stats = Array.isArray(data) ? data : [];
        const withWeeks = stats
          .map((row) => {
            const nameVal = getStatValue(row, "Name", "name", "PlayerName", "Player");
            const name =
              nameVal != null && nameVal !== "" ? String(nameVal) : BYE_LABEL;
            const weeks = toNumber(
              getStatValue(row, "Weeks", "weeks", "WeeksPlayed")
            );
            const legacyAverage = toNumber(
              getStatValue(
                row,
                "LegacyAverage",
                "LegacyAve",
                "legacyaverage",
                "legacyave",
                "Legacy_Average"
              )
            );
            const raceTo =
              legacyAverage != null ? Math.ceil(legacyAverage * 6) : null;
            return { playerName: name, weeks, raceTo };
          })
          .filter((r) => r.weeks != null && r.weeks > 7);
        withWeeks.sort((a, b) =>
          a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" })
        );
        const byeCount = Math.max(0, PLAYER_SLOTS - withWeeks.length);
        const byes = Array(byeCount)
          .fill(null)
          .map(() => ({ playerName: BYE_LABEL, raceTo: null as number | null }));
        setPlayerRows([...withWeeks, ...byes].slice(0, PLAYER_SLOTS));
        setLoadingPlayers(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPlayerRows([]);
          setLoadingPlayers(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leagueGuid]);

  const playerDisplayNames = useMemo(() => {
    let byeNum = 0;
    return playerRows.map((r) =>
      r.playerName === BYE_LABEL ? `-- Bye ${++byeNum} --` : r.playerName
    );
  }, [playerRows]);

  const playerRaceToMap = useMemo(
    () =>
      Object.fromEntries(
        playerRows.map((r) => [r.playerName, r.raceTo] as [string, number | null])
      ),
    [playerRows]
  );

  const allFirstRoundSelections = useMemo(() => {
    if (!settings || typeof settings !== "object") return Array(64).fill("") as string[];
    const s = settings as Record<string, unknown>;
    const out: string[] = [];
    for (let c = 0; c < 8; c++) {
      for (let i = 0; i < 8; i++) {
        const key = `bracketSlot${c * 12 + i}`;
        const v = s[key];
        out.push(typeof v === "string" ? v : "");
      }
    }
    return out;
  }, [settings]);

  const getLocationName = useCallback(
    (key: (typeof WEEK_1_LOCATION_KEYS)[number]) => {
      if (!settings || typeof settings !== "object") return "TBD";
      const v = (settings as Record<string, unknown>)[key];
      const s = typeof v === "string" ? v.trim() : "";
      return s || "TBD";
    },
    [settings]
  );

  const getInitialSlotsForCard = useCallback(
    (cardIndex: number) => {
      if (!settings || typeof settings !== "object") return undefined;
      const s = settings as Record<string, unknown>;
      let byeNum = 0;
      const base = cardIndex * 12;
      return Array.from({ length: 12 }, (_, i) => {
        const slotKey = `bracketSlot${base + i}`;
        const v = s[slotKey];
        const val = typeof v === "string" ? v : "";
        if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
        return val;
      });
    },
    [settings]
  );

  const getInitialScoresForCard = useCallback(
    (cardIndex: number) => {
      if (!settings || typeof settings !== "object") return undefined;
      const s = settings as Record<string, unknown>;
      return Array.from({ length: 12 }, (_, i) => {
        const topOrBottom = i % 2 === 0 ? "Top" : "Bottom";
        const matchIndex = Math.floor(i / 2);
        const globalIndex = cardIndex * 6 + matchIndex;
        const key = `bracketScore${topOrBottom}${globalIndex}`;
        const v = s[key];
        return typeof v === "string" ? v : "0";
      });
    },
    [settings]
  );

  /** Returns the match index (0–5) in this card where the linked user is a player, or null. */
  const getMyMatchInCard = useCallback(
    (cardIndex: number): number | null => {
      if (!settings || typeof settings !== "object" || !linkedName) return null;
      const s = settings as Record<string, unknown>;
      const base = cardIndex * 12;
      for (let m = 0; m < 6; m++) {
        const [top, bottom] = slotIndicesForMatch(m);
        const topVal = (s[`bracketSlot${base + top}`] as string) ?? "";
        const bottomVal = (s[`bracketSlot${base + bottom}`] as string) ?? "";
        const topNorm = topVal.trim().toLowerCase();
        const bottomNorm = bottomVal.trim().toLowerCase();
        if (topNorm === linkedName || bottomNorm === linkedName) return m;
      }
      return null;
    },
    [settings, linkedName]
  );

  const cardContainsUser = useCallback(
    (cardIndex: number) => getMyMatchInCard(cardIndex) !== null,
    [getMyMatchInCard]
  );

  /** True when both players are selected and the matchup status is "Match Ready" (stored value empty or literal "Match Ready"). */
  const isMatchReady = useCallback(
    (cardIndex: number, matchIndex: number): boolean => {
      if (!settings || typeof settings !== "object") return false;
      const s = settings as Record<string, unknown>;
      const base = cardIndex * 12;
      const [top, bottom] = slotIndicesForMatch(matchIndex);
      const topVal = ((s[`bracketSlot${base + top}`] as string) ?? "").trim();
      const bottomVal = ((s[`bracketSlot${base + bottom}`] as string) ?? "").trim();
      if (!topVal || !bottomVal) return false;
      const key = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
      const val = ((s[key] as string) ?? "").trim();
      return val === "" || val.toLowerCase() === "match ready";
    },
    [settings]
  );

  const showLiveScoreButton = useCallback(
    (cardIndex: number) => {
      const matchIndex = getMyMatchInCard(cardIndex);
      if (matchIndex === null) return false;
      return isMatchReady(cardIndex, matchIndex);
    },
    [getMyMatchInCard, isMatchReady]
  );

  /** Raw status for the user's matchup on this card, or null. */
  const getMyMatchStatusRaw = useCallback(
    (cardIndex: number): string | null => {
      const matchIndex = getMyMatchInCard(cardIndex);
      if (matchIndex === null || !settings || typeof settings !== "object") return null;
      const s = settings as Record<string, unknown>;
      const key = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
      const val = ((s[key] as string) ?? "").trim();
      return val || null;
    },
    [getMyMatchInCard, settings]
  );

  /** Per-matchup status for this card (6 matchups) for bracket row styling. */
  const getMatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!settings || typeof settings !== "object") return Array(6).fill(null);
      const s = settings as Record<string, unknown>;
      return Array.from({ length: 6 }, (_, i) => {
        const val = (s[`bracketMatchStatus${cardIndex * 6 + i}`] as string) ?? "";
        return val.trim() || null;
      });
    },
    [settings]
  );

  if (!loadingTimedOut && (status === "loading" || settings === undefined)) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-black/40 p-6">
        <p className="text-sm text-blue-200/80">Loading…</p>
      </div>
    );
  }

  if (loadingTimedOut && (status === "loading" || settings === undefined)) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-black/40 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-blue-100">
          EOSLT
        </h1>
        <p className="mt-2 text-sm text-blue-200/80">
          Taking longer than usual. Check that{" "}
          <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_CONVEX_URL</code>{" "}
          is set in your deployment and Convex is deployed.
        </p>
        <p className="mt-2 text-sm text-blue-200/80">
          Or use the navigation to open Dashboard or Profile.
        </p>
      </div>
    );
  }

  if (!hasLeagueAndSeason) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-black/40 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-blue-100">
          EOSLT
        </h1>
        <p className="mt-2 text-sm text-blue-200/80">
          Use the navigation to open Dashboard or Profile.
        </p>
      </div>
    );
  }

  if (loadingPlayers && playerRows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--surface-border)] bg-black/40 p-6">
        <p className="text-sm text-blue-200/80">Loading bracket data…</p>
      </div>
    );
  }

  const settingsRecord = settings as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-purple-950 via-violet-900 to-purple-950 px-5 py-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-blue-100">
          {String(settingsRecord.leagueName)} – {String(settingsRecord.season)}
        </h1>
        <p className="mt-1 text-sm text-blue-200/80">
          End of Season Tournament:{" "}
          {settingsRecord.tournamentStarted === true
            ? settingsRecord.tournamentPaused === true
              ? "Currently Paused"
              : "In Progress..."
            : "Reset"}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-[4.5rem]">
        {WEEK_1_LOCATION_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 max-w-[600px] overflow-hidden rounded-xl border border-white/40 bg-black text-foreground sm:min-w-[555px]"
          >
            <div className="flex min-h-14 w-full flex-shrink-0 items-center justify-between gap-3 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight text-blue-100">
                {getLocationName(key)}
              </h2>
              {linkedName &&
                getMyMatchInCard(index) !== null &&
                (getMyMatchStatusRaw(index) === "Paused" ||
                  getMyMatchStatusRaw(index) === "Paused..." ||
                  (tournamentInProgress && getMyMatchStatusRaw(index) !== "Completed")) && (
                <div className="flex shrink-0 items-center gap-3">
                  {getMyMatchStatusRaw(index) !== "Completed" &&
                    (getMyMatchStatusRaw(index) === "Paused" || getMyMatchStatusRaw(index) === "Paused..." ? (
                      <button
                        type="button"
                        onClick={() => {
                          const matchIndex = getMyMatchInCard(index);
                          if (matchIndex === null) return;
                          router.push(`/live-scoring?card=${index}&match=${matchIndex}`);
                        }}
                        className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-3 py-1.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      >
                        Resume Match
                      </button>
                    ) : tournamentInProgress ? (
                      <button
                        type="button"
                        onClick={() => {
                          const matchIndex = getMyMatchInCard(index);
                          if (matchIndex === null || !email || !settings || typeof settings !== "object") return;
                          const s = settings as Record<string, unknown>;
                          const statusKey = `bracketMatchStatus${index * 6 + matchIndex}`;
                          setDashboardSettings({
                            email,
                            leagueName: String(s.leagueName ?? ""),
                            season: String(s.season ?? ""),
                            tournamentStarted: s.tournamentStarted === true,
                            tournamentPaused: s.tournamentPaused === true,
                            [statusKey]: "In Progress...",
                          } as Parameters<typeof setDashboardSettings>[0]);
                          router.push(`/live-scoring?card=${index}&match=${matchIndex}`);
                        }}
                        className="rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                      >
                        Live Score My Match
                      </button>
                    ) : null)}
                </div>
              )}
            </div>
            <div className="min-h-0 overflow-auto rounded-b-xl border-t border-white/40 bg-black pt-4 pl-4">
              <Bracket8TwoRounds
                players={playerDisplayNames}
                playerRaceToMap={playerRaceToMap}
                initialSlotSelections={getInitialSlotsForCard(index)}
                initialScores={getInitialScoresForCard(index)}
                cardIndex={index}
                allFirstRoundSelections={allFirstRoundSelections}
                disabled
                matchStatusByIndex={getMatchStatusByIndex(index)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
