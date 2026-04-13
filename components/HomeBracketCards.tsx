"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bracket8TwoRounds } from "@/components/Bracket8TwoRounds";
import { Bracket4, applyByeAdvancesToBracket4 } from "@/components/Bracket4";
import { formatLocationDate, formatLocationTime } from "@/lib/formatDateTime";
import { deriveMatchStatusForRaceCellStyle } from "@/lib/bracketMatchRaceStyle";
import {
  bracketMatchStatusIsCompleted,
  bracketParticipantNamesMatch,
} from "@/lib/bracketNameMatch";
import { liveScoreGamesGlobalKey } from "@/lib/liveScoringGlobalKey";
import { parseFinalsBracketMatchStatusesJson } from "@/lib/finalsBracketMatchStatuses";
import {
  FINALS_MATCH_FORFEIT_COUNT,
  parseMatchForfeitsJson,
  WEEK1_MATCH_FORFEIT_COUNT,
  WEEK2_MATCH_FORFEIT_COUNT,
} from "@/lib/matchForfeitsJson";
import {
  parseWeek2BracketMatchStatusesJson,
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
  week2SlotPairIndices,
} from "@/lib/week2BracketSlots";

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

const WEEK_2_LOCATION_KEYS = [
  "secondWeekLocation1",
  "secondWeekLocation2",
  "secondWeekLocation3",
  "secondWeekLocation4",
] as const;

const FINALS_LOCATION_KEY = "finalsLocation" as const;
const HOME_COLLAPSE_STATE_KEY = "eoslt:home-bracket-collapse";

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
  const settings = useQuery(api.dashboardSettings.getPublic, {});
  /** Per-user row: collapse prefs only (not shared tournament data). */
  const patchMyDashboardRow = useMutation(api.dashboardSettings.set);
  /** Canonical tournament doc — same source as getPublic (bracket + match statuses). */
  const patchSharedTournament = useMutation(api.dashboardSettings.setShared);
  /** Per-user row (collapse prefs); tournament data still comes from getPublic. */
  const myUserSettings = useQuery(api.dashboardSettings.get, email ? { email } : "skip");
  const convexUser = useQuery(
    api.users.getByEmail,
    email ? { email } : "skip"
  );

  const [leagueGuid, setLeagueGuid] = useState<string | null>(null);

  /** Raw PoolHub player name from Convex (trimmed). Compare to bracket slots with `bracketParticipantNamesMatch`. */
  const linkedPoolhubRaw = convexUser?.poolhubPlayerName?.trim() ?? "";
  const hasLinkedPoolhubPlayer = linkedPoolhubRaw.length > 0;
  const [playerRows, setPlayerRows] = useState<
    { playerName: string; raceTo: number | null }[]
  >([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [bracketError, setBracketError] = useState(false);
  const [week2CardsOpen, setWeek2CardsOpen] = useState<boolean[]>(() => Array(4).fill(true));
  const [finalsCardOpen, setFinalsCardOpen] = useState(true);

  const openReadOnlyScorecard = useCallback(
    (stage: "week1" | "week2" | "finals", cardIndex: number, matchIndex: number) => {
      router.push(
        `/live-scoring?stage=${stage}&card=${cardIndex}&match=${matchIndex}&readonly=1`
      );
    },
    [router]
  );
  const collapseStorageKey = useMemo(() => {
    if (!settings || typeof settings !== "object") return HOME_COLLAPSE_STATE_KEY;
    const s = settings as Record<string, unknown>;
    const leagueName = typeof s.leagueName === "string" ? s.leagueName.trim() : "";
    const season = typeof s.season === "string" ? s.season.trim() : "";
    return leagueName && season
      ? `${HOME_COLLAPSE_STATE_KEY}:${leagueName}:${season}`
      : HOME_COLLAPSE_STATE_KEY;
  }, [settings]);

  useEffect(() => {
    if (status !== "loading" && settings !== undefined) return;
    const t = setTimeout(() => setLoadingTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [status, settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (email && myUserSettings === undefined) return;

    const readLocal = () => {
      try {
        const raw = window.localStorage.getItem(collapseStorageKey);
        if (!raw) {
          setWeek2CardsOpen(Array(4).fill(true));
          setFinalsCardOpen(true);
          return;
        }
        const parsed = JSON.parse(raw) as {
          week2CardsOpen?: unknown;
          finalsCardOpen?: unknown;
        };
        setWeek2CardsOpen(
          Array.isArray(parsed.week2CardsOpen) && parsed.week2CardsOpen.length === 4
            ? parsed.week2CardsOpen.map((value) => value === true)
            : Array(4).fill(true)
        );
        setFinalsCardOpen(parsed.finalsCardOpen === false ? false : true);
      } catch {
        setWeek2CardsOpen(Array(4).fill(true));
        setFinalsCardOpen(true);
      }
    };

    if (email && myUserSettings !== undefined) {
      if (myUserSettings !== null) {
        const ui = myUserSettings as Record<string, unknown>;
        setWeek2CardsOpen(
          [0, 1, 2, 3].map((i) => {
            const v = ui[`uiWeek2Slot${i}Open`];
            if (v === true || v === false) return v;
            return true;
          })
        );
        const fv = ui.uiFinalsCardOpen;
        setFinalsCardOpen(fv === true ? true : fv === false ? false : true);
        return;
      }
      readLocal();
      return;
    }

    readLocal();
  }, [email, myUserSettings, collapseStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (email) {
      if (!settings || typeof settings !== "object") return;
      const s = settings as Record<string, unknown>;
      const leagueName = String(s.leagueName ?? "").trim();
      const season = String(s.season ?? "").trim();
      if (!leagueName || !season || myUserSettings === undefined) return;
      void patchMyDashboardRow({
        email,
        leagueName,
        season,
        uiWeek2Slot0Open: week2CardsOpen[0],
        uiWeek2Slot1Open: week2CardsOpen[1],
        uiWeek2Slot2Open: week2CardsOpen[2],
        uiWeek2Slot3Open: week2CardsOpen[3],
        uiFinalsCardOpen: finalsCardOpen,
      } as Parameters<typeof patchMyDashboardRow>[0]);
      return;
    }
    window.localStorage.setItem(
      collapseStorageKey,
      JSON.stringify({ week2CardsOpen, finalsCardOpen })
    );
  }, [
    email,
    myUserSettings,
    collapseStorageKey,
    week2CardsOpen,
    finalsCardOpen,
    settings,
    patchMyDashboardRow,
  ]);

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
  const showBracketsOnHomeScreen =
    settings &&
    typeof settings === "object" &&
    (settings as Record<string, unknown>).showBracketsOnHomeScreen === true;
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
      setBracketError(false);
      return;
    }
    let cancelled = false;
    setBracketError(false);
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
          setBracketError(true);
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
    (
      key:
        | (typeof WEEK_1_LOCATION_KEYS)[number]
        | (typeof WEEK_2_LOCATION_KEYS)[number]
        | typeof FINALS_LOCATION_KEY
    ) => {
      if (!settings || typeof settings !== "object") return "TBD";
      const v = (settings as Record<string, unknown>)[key];
      const s = typeof v === "string" ? v.trim() : "";
      return s || "TBD";
    },
    [settings]
  );

  const getLocationStartDate = useCallback(
    (
      key:
        | (typeof WEEK_1_LOCATION_KEYS)[number]
        | (typeof WEEK_2_LOCATION_KEYS)[number]
        | typeof FINALS_LOCATION_KEY
    ) => {
      if (!settings || typeof settings !== "object") return "";
      const raw = (settings as Record<string, unknown>).locationStartMeta;
      if (typeof raw !== "string" || !raw.trim()) return "";
      try {
        const meta = JSON.parse(raw) as Record<string, { startDate?: string }>;
        const entry = meta[key];
        return (entry && typeof entry.startDate === "string") ? entry.startDate : "";
      } catch {
        return "";
      }
    },
    [settings]
  );

  const getLocationStartTime = useCallback(
    (
      key:
        | (typeof WEEK_1_LOCATION_KEYS)[number]
        | (typeof WEEK_2_LOCATION_KEYS)[number]
        | typeof FINALS_LOCATION_KEY
    ) => {
      if (!settings || typeof settings !== "object") return "";
      const raw = (settings as Record<string, unknown>).locationStartMeta;
      if (typeof raw !== "string" || !raw.trim()) return "";
      try {
        const meta = JSON.parse(raw) as Record<string, { startTime?: string }>;
        const entry = meta[key];
        return (entry && typeof entry.startTime === "string") ? entry.startTime : "";
      } catch {
        return "";
      }
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

  /**
   * Match index (0–5) on this Week 1 card where the linked user plays, or null.
   * Scans matches 5→0 so Week 1 round 2 (matches 4–5) wins over round 1 (0–3): completed
   * first-round rows often still show the player name, which hid “Live Score My Match” for round 2.
   */
  const getMyMatchInCard = useCallback(
    (cardIndex: number): number | null => {
      if (!settings || typeof settings !== "object" || !hasLinkedPoolhubPlayer) return null;
      const s = settings as Record<string, unknown>;
      const base = cardIndex * 12;
      for (let m = 5; m >= 0; m--) {
        const [top, bottom] = slotIndicesForMatch(m);
        const topVal = (s[`bracketSlot${base + top}`] as string) ?? "";
        const bottomVal = (s[`bracketSlot${base + bottom}`] as string) ?? "";
        if (
          bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) ||
          bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw)
        ) {
          return m;
        }
      }
      return null;
    },
    [settings, hasLinkedPoolhubPlayer, linkedPoolhubRaw]
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

  /** Per-matchup status for this card (6 matchups) for bracket row styling; includes partial live scorecards. */
  const getMatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!settings || typeof settings !== "object") return Array(6).fill(null);
      const s = settings as Record<string, unknown>;
      return Array.from({ length: 6 }, (_, i) => {
        const globalIdx = cardIndex * 6 + i;
        const rawStatus = ((s[`bracketMatchStatus${globalIdx}`] as string) ?? "").trim() || null;
        const liveJson = s[`liveScoreGames${globalIdx}`] as string | undefined;
        return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
      });
    },
    [settings]
  );

  /**
   * Week 1 bracket name click: read-only for spectators or completed matches; linked players who
   * could use “Live Score My Match” get the same navigation and status update as that button.
   */
  const handleWeek1BracketMatchClick = useCallback(
    (cardIndex: number, matchIndex: number) => {
      if (!settings || typeof settings !== "object") {
        openReadOnlyScorecard("week1", cardIndex, matchIndex);
        return;
      }
      const s = settings as Record<string, unknown>;
      const base = cardIndex * 12;
      const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
      const topVal = ((s[`bracketSlot${base + topSlot}`] as string) ?? "").trim();
      const bottomVal = ((s[`bracketSlot${base + bottomSlot}`] as string) ?? "").trim();
      if (
        !hasLinkedPoolhubPlayer ||
        (!bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) &&
          !bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw))
      ) {
        openReadOnlyScorecard("week1", cardIndex, matchIndex);
        return;
      }

      const stRaw = ((s[`bracketMatchStatus${cardIndex * 6 + matchIndex}`] as string) ?? "").trim();
      const st = stRaw || null;

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?card=${cardIndex}&match=${matchIndex}`);
        return;
      }

      if (tournamentInProgress && !bracketMatchStatusIsCompleted(st)) {
        const inProgress = st === "In Progress...";
        if ((!topVal || !bottomVal) && !inProgress) {
          openReadOnlyScorecard("week1", cardIndex, matchIndex);
          return;
        }
        if (!email) {
          openReadOnlyScorecard("week1", cardIndex, matchIndex);
          return;
        }
        const statusKey = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
        void patchSharedTournament({
          leagueName: String(s.leagueName ?? ""),
          season: String(s.season ?? ""),
          tournamentStarted: s.tournamentStarted === true,
          tournamentPaused: s.tournamentPaused === true,
          [statusKey]: "In Progress...",
        } as Parameters<typeof patchSharedTournament>[0]);
        router.push(`/live-scoring?card=${cardIndex}&match=${matchIndex}`);
        return;
      }

      openReadOnlyScorecard("week1", cardIndex, matchIndex);
    },
    [
      settings,
      hasLinkedPoolhubPlayer,
      linkedPoolhubRaw,
      tournamentInProgress,
      email,
      patchSharedTournament,
      router,
      openReadOnlyScorecard,
    ]
  );

  const week2BracketSlotsArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).week2BracketSlots
        : undefined;
    return parseWeek2BracketSlotsJson(raw);
  }, [settings]);

  const week2BracketScoresArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).week2BracketScores
        : undefined;
    return parseWeek2BracketScoresJson(raw);
  }, [settings]);

  const week2BracketMatchStatusesArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).week2BracketMatchStatuses
        : undefined;
    return parseWeek2BracketMatchStatusesJson(raw);
  }, [settings]);

  const finalsBracketSlotsArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).finalsBracketSlots
        : undefined;
    if (typeof raw !== "string" || !raw.trim()) return Array(6).fill("") as string[];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 6) return Array(6).fill("") as string[];
      return arr.map((v) => (typeof v === "string" ? v : ""));
    } catch {
      return Array(6).fill("") as string[];
    }
  }, [settings]);

  /** Same 6 slots as Bracket4 after bye labels + bye propagation (championship row may differ from raw JSON). */
  const finalsEffectiveSlotsForLink = useMemo(() => {
    let byeNum = 0;
    const mapped = finalsBracketSlotsArray.map((val) =>
      val === BYE_LABEL ? `-- Bye ${++byeNum} --` : val
    );
    return applyByeAdvancesToBracket4(mapped);
  }, [finalsBracketSlotsArray]);

  const finalsChampionshipMatchIndex = 2;

  const finalsBracketScoresArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).finalsBracketScores
        : undefined;
    if (typeof raw !== "string" || !raw.trim()) return Array(6).fill("0") as string[];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 6) return Array(6).fill("0") as string[];
      return arr.map((v) => (typeof v === "string" ? v : "0"));
    } catch {
      return Array(6).fill("0") as string[];
    }
  }, [settings]);

  const finalsBracketMatchStatusesArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).finalsBracketMatchStatuses
        : undefined;
    return parseFinalsBracketMatchStatusesJson(raw);
  }, [settings]);

  const week1MatchForfeitsArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).week1MatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, WEEK1_MATCH_FORFEIT_COUNT);
  }, [settings]);

  const week2MatchForfeitsArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).week2MatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, WEEK2_MATCH_FORFEIT_COUNT);
  }, [settings]);

  const finalsMatchForfeitsArray = useMemo(() => {
    const raw =
      settings && typeof settings === "object"
        ? (settings as Record<string, unknown>).finalsMatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, FINALS_MATCH_FORFEIT_COUNT);
  }, [settings]);

  const getWeek2MatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!settings || typeof settings !== "object") return Array(3).fill(null);
      const s = settings as Record<string, unknown>;
      return Array.from({ length: 3 }, (_, i) => {
        const val = week2BracketMatchStatusesArray[cardIndex * 3 + i] ?? "";
        const rawStatus = val.trim() || null;
        const gk = liveScoreGamesGlobalKey("week2", cardIndex, i);
        const liveJson = s[`liveScoreGames${gk}`] as string | undefined;
        return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
      });
    },
    [settings, week2BracketMatchStatusesArray]
  );

  const getFinalsMatchStatusByIndex = useCallback((): (string | null)[] => {
    if (!settings || typeof settings !== "object") return Array(3).fill(null);
    const s = settings as Record<string, unknown>;
    return Array.from({ length: 3 }, (_, i) => {
      const val = finalsBracketMatchStatusesArray[i] ?? "";
      const rawStatus = val.trim() || null;
      const gk = liveScoreGamesGlobalKey("finals", 0, i);
      const liveJson = s[`liveScoreGames${gk}`] as string | undefined;
      return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
    });
  }, [settings, finalsBracketMatchStatusesArray]);

  /**
   * Week 2 match index (0–2) on this card where the linked user plays, or null.
   * Scans 2→0 so later rounds win when names still appear in earlier rows.
   */
  const getMyMatchInWeek2Card = useCallback(
    (cardIndex: number): number | null => {
      if (!hasLinkedPoolhubPlayer) return null;
      const base = cardIndex * 6;
      for (let m = 2; m >= 0; m--) {
        const [top, bottom] = week2SlotPairIndices(m);
        const topVal = week2BracketSlotsArray[base + top] ?? "";
        const bottomVal = week2BracketSlotsArray[base + bottom] ?? "";
        if (
          bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) ||
          bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw)
        ) {
          return m;
        }
      }
      return null;
    },
    [hasLinkedPoolhubPlayer, linkedPoolhubRaw, week2BracketSlotsArray]
  );

  const getMyWeek2MatchStatusRaw = useCallback(
    (cardIndex: number): string | null => {
      const matchIndex = getMyMatchInWeek2Card(cardIndex);
      if (matchIndex === null) return null;
      const s = week2BracketMatchStatusesArray[cardIndex * 3 + matchIndex] ?? "";
      return s.trim() || null;
    },
    [getMyMatchInWeek2Card, week2BracketMatchStatusesArray]
  );

  /**
   * Finals match index (0–2): semis use raw slots; championship uses effective slots 4–5
   * (bye propagation matches Bracket4). Scans 2→0 so the final wins when names still appear in semis.
   */
  const getMyMatchInFinals = useCallback((): number | null => {
    if (!hasLinkedPoolhubPlayer) return null;
    for (let m = finalsChampionshipMatchIndex; m >= 0; m--) {
      const [top, bottom] = week2SlotPairIndices(m);
      const topVal =
        m === finalsChampionshipMatchIndex
          ? (finalsEffectiveSlotsForLink[top] ?? "")
          : (finalsBracketSlotsArray[top] ?? "");
      const bottomVal =
        m === finalsChampionshipMatchIndex
          ? (finalsEffectiveSlotsForLink[bottom] ?? "")
          : (finalsBracketSlotsArray[bottom] ?? "");
      if (
        bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) ||
        bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw)
      ) {
        return m;
      }
    }
    return null;
  }, [
    hasLinkedPoolhubPlayer,
    linkedPoolhubRaw,
    finalsBracketSlotsArray,
    finalsEffectiveSlotsForLink,
    finalsChampionshipMatchIndex,
  ]);

  const getMyFinalsMatchStatusRaw = useCallback((): string | null => {
    const matchIndex = getMyMatchInFinals();
    if (matchIndex === null) return null;
    const s = finalsBracketMatchStatusesArray[matchIndex] ?? "";
    return s.trim() || null;
  }, [getMyMatchInFinals, finalsBracketMatchStatusesArray]);

  const handleWeek2BracketMatchClick = useCallback(
    (cardIndex: number, matchIndex: number) => {
      if (!settings || typeof settings !== "object") {
        openReadOnlyScorecard("week2", cardIndex, matchIndex);
        return;
      }
      const s = settings as Record<string, unknown>;
      const base = cardIndex * 6;
      const [topSlot, bottomSlot] = week2SlotPairIndices(matchIndex);
      const topVal = (week2BracketSlotsArray[base + topSlot] ?? "").trim();
      const bottomVal = (week2BracketSlotsArray[base + bottomSlot] ?? "").trim();
      if (
        !hasLinkedPoolhubPlayer ||
        (!bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) &&
          !bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw))
      ) {
        openReadOnlyScorecard("week2", cardIndex, matchIndex);
        return;
      }

      const idx = cardIndex * 3 + matchIndex;
      const stRaw = (week2BracketMatchStatusesArray[idx] ?? "").trim();
      const st = stRaw || null;

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?stage=week2&card=${cardIndex}&match=${matchIndex}`);
        return;
      }

      if (tournamentInProgress && !bracketMatchStatusIsCompleted(st)) {
        const inProgress = st === "In Progress...";
        if ((!topVal || !bottomVal) && !inProgress) {
          openReadOnlyScorecard("week2", cardIndex, matchIndex);
          return;
        }
        if (!email) {
          openReadOnlyScorecard("week2", cardIndex, matchIndex);
          return;
        }
        const nextStatuses = [...week2BracketMatchStatusesArray];
        nextStatuses[idx] = "In Progress...";
        void patchSharedTournament({
          leagueName: String(s.leagueName ?? ""),
          season: String(s.season ?? ""),
          tournamentStarted: s.tournamentStarted === true,
          tournamentPaused: s.tournamentPaused === true,
          week2BracketMatchStatuses: JSON.stringify(nextStatuses),
        } as Parameters<typeof patchSharedTournament>[0]);
        router.push(`/live-scoring?stage=week2&card=${cardIndex}&match=${matchIndex}`);
        return;
      }

      openReadOnlyScorecard("week2", cardIndex, matchIndex);
    },
    [
      settings,
      hasLinkedPoolhubPlayer,
      linkedPoolhubRaw,
      tournamentInProgress,
      email,
      patchSharedTournament,
      router,
      openReadOnlyScorecard,
      week2BracketSlotsArray,
      week2BracketMatchStatusesArray,
    ]
  );

  const handleFinalsBracketMatchClick = useCallback(
    (matchIndex: number) => {
      if (!settings || typeof settings !== "object") {
        openReadOnlyScorecard("finals", 0, matchIndex);
        return;
      }
      const s = settings as Record<string, unknown>;
      const [topSlot, bottomSlot] = week2SlotPairIndices(matchIndex);
      const topVal = (finalsBracketSlotsArray[topSlot] ?? "").trim();
      const bottomVal = (finalsBracketSlotsArray[bottomSlot] ?? "").trim();
      const effTop = (finalsEffectiveSlotsForLink[topSlot] ?? "").trim();
      const effBottom = (finalsEffectiveSlotsForLink[bottomSlot] ?? "").trim();
      const linkedInRawPair =
        bracketParticipantNamesMatch(topVal, linkedPoolhubRaw) ||
        bracketParticipantNamesMatch(bottomVal, linkedPoolhubRaw);
      const linkedInChampionshipEffective =
        matchIndex === finalsChampionshipMatchIndex &&
        (bracketParticipantNamesMatch(finalsEffectiveSlotsForLink[4] ?? "", linkedPoolhubRaw) ||
          bracketParticipantNamesMatch(finalsEffectiveSlotsForLink[5] ?? "", linkedPoolhubRaw));
      if (!hasLinkedPoolhubPlayer || (!linkedInRawPair && !linkedInChampionshipEffective)) {
        openReadOnlyScorecard("finals", 0, matchIndex);
        return;
      }

      const stRaw = (finalsBracketMatchStatusesArray[matchIndex] ?? "").trim();
      const st = stRaw || null;

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?stage=finals&card=0&match=${matchIndex}`);
        return;
      }

      if (tournamentInProgress && !bracketMatchStatusIsCompleted(st)) {
        const inProgress = st === "In Progress...";
        const pairTop = matchIndex === finalsChampionshipMatchIndex ? effTop : topVal;
        const pairBottom = matchIndex === finalsChampionshipMatchIndex ? effBottom : bottomVal;
        if ((!pairTop || !pairBottom) && !inProgress) {
          openReadOnlyScorecard("finals", 0, matchIndex);
          return;
        }
        if (!email) {
          openReadOnlyScorecard("finals", 0, matchIndex);
          return;
        }
        const nextStatuses = [...finalsBracketMatchStatusesArray];
        nextStatuses[matchIndex] = "In Progress...";
        void patchSharedTournament({
          leagueName: String(s.leagueName ?? ""),
          season: String(s.season ?? ""),
          tournamentStarted: s.tournamentStarted === true,
          tournamentPaused: s.tournamentPaused === true,
          finalsBracketMatchStatuses: JSON.stringify(nextStatuses),
        } as Parameters<typeof patchSharedTournament>[0]);
        router.push(`/live-scoring?stage=finals&card=0&match=${matchIndex}`);
        return;
      }

      openReadOnlyScorecard("finals", 0, matchIndex);
    },
    [
      settings,
      hasLinkedPoolhubPlayer,
      linkedPoolhubRaw,
      tournamentInProgress,
      email,
      patchSharedTournament,
      router,
      openReadOnlyScorecard,
      finalsBracketSlotsArray,
      finalsEffectiveSlotsForLink,
      finalsBracketMatchStatusesArray,
    ]
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
          Taking longer than usual. Please refresh the page or use the navigation to open Dashboard or Profile.
        </p>
      </div>
    );
  }

  const notSetupYet = !hasLeagueAndSeason || !showBracketsOnHomeScreen;
  if (notSetupYet) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 text-center">
        <p className="text-2xl font-semibold text-yellow-400 sm:text-3xl">
          Tournament hasn&apos;t been setup yet. Brackets will be posted once the drawing is complete and ready.
        </p>
        {(email && convexUser !== undefined && !hasLinkedPoolhubPlayer) || !email ? (
          <div className="text-lg text-blue-200/90 sm:text-xl space-y-3">
            {email ? (
              <p>To link your account to your PoolHub player, go to the Profile tab.</p>
            ) : (
              <>
                <p>
                  If you are just viewing the bracket, then this page is all you need to view. If you are a player and plan to live score your match, you will need to create an account and link your PoolHub player to your new account. You can log in with Google (Recommended), or you can register with an email and password.
                </p>
                <p>
                  Once your account is created, go to the Profile page to link your new account to your PoolHub player. After that, you will be able to Live Score your Match!
                </p>
                <p>
                  The need for a new account and linking to PoolHub is to avoid using the same servers as PoolHub since we know that there are sometimes server issues. This will eliminate any issues because the new server is MUCH more reliable.
                </p>
              </>
            )}
          </div>
        ) : null}
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

  if (
    bracketError ||
    (hasLeagueAndSeason && tournamentStarted && !tournamentPaused && !loadingPlayers && playerRows.length === 0)
  ) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl font-semibold text-yellow-400 sm:text-2xl">
          Oops, Something went wrong. Try again later.
        </p>
      </div>
    );
  }

  const settingsRecord = settings as Record<string, unknown>;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="w-full rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-purple-950 via-violet-900 to-purple-950 px-5 py-4 text-center">
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
      <div className="w-full overflow-x-auto">
        <div className="mx-auto flex min-w-full w-max items-start justify-center gap-6 pb-16">
          <div className="flex w-max min-w-0 flex-col gap-6">
            <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
              Week 1
            </h2>
            {WEEK_1_LOCATION_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 max-w-[600px] overflow-hidden rounded-xl border border-white/40 bg-black text-foreground sm:min-w-[555px]"
          >
            <div className="flex min-h-14 w-full flex-shrink-0 flex-col gap-1 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4">
              <div className="w-full">
                <h2 className="min-w-0 truncate pb-2 text-center text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                  {getLocationName(key)}
                </h2>
              </div>
              {hasLinkedPoolhubPlayer &&
              tournamentInProgress &&
              getMyMatchInCard(index) !== null &&
              (getMyMatchStatusRaw(index) === "Paused" ||
                getMyMatchStatusRaw(index) === "Paused..." ||
                !bracketMatchStatusIsCompleted(getMyMatchStatusRaw(index))) && (
                <div className="w-full pb-2">
                  <div className="flex w-full">
                    {!bracketMatchStatusIsCompleted(getMyMatchStatusRaw(index)) &&
                      (getMyMatchStatusRaw(index) === "Paused" || getMyMatchStatusRaw(index) === "Paused..." ? (
                        <button
                          type="button"
                          onClick={() => {
                            const matchIndex = getMyMatchInCard(index);
                            if (matchIndex === null) return;
                            router.push(`/live-scoring?card=${index}&match=${matchIndex}`);
                          }}
                          className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                          Resume Match
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const matchIndex = getMyMatchInCard(index);
                            if (matchIndex === null) return;
                            handleWeek1BracketMatchClick(index, matchIndex);
                          }}
                          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                          Live Score My Match
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-3 text-sm font-medium text-blue-100/90">
                <span className="text-left">Week 1</span>
                <span className="text-center">
                  {formatLocationDate(getLocationStartDate(key)) || "—"}
                </span>
                <span className="text-right">
                  {formatLocationTime(getLocationStartTime(key)) || "—"}
                </span>
              </div>
            </div>
            <div className="min-h-0 overflow-auto rounded-b-xl border-t border-white/40 bg-black pb-4 pt-4 pl-4">
              <Bracket8TwoRounds
                players={playerDisplayNames}
                playerRaceToMap={playerRaceToMap}
                initialSlotSelections={getInitialSlotsForCard(index)}
                initialScores={getInitialScoresForCard(index)}
                cardIndex={index}
                allFirstRoundSelections={allFirstRoundSelections}
                disabled
                placeholderText="TBD..."
                matchStatusByIndex={getMatchStatusByIndex(index)}
                onMatchClickByIndex={(matchIndex) =>
                  handleWeek1BracketMatchClick(index, matchIndex)
                }
                matchForfeitingPlayerByMatchIndex={week1MatchForfeitsArray.slice(
                  index * 6,
                  index * 6 + 6
                )}
              />
            </div>
          </div>
            ))}
          </div>
          <div className="flex w-max min-w-0 flex-col gap-6">
            <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
              Week 2
            </h2>
            {WEEK_2_LOCATION_KEYS.map((key, index) => (
              <div
                key={key}
                className="w-full min-w-0 max-w-[600px] overflow-hidden rounded-xl border border-white/40 bg-black text-foreground sm:min-w-[555px]"
              >
                <div
                  className={`flex min-h-14 w-full flex-shrink-0 flex-col gap-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4 ${week2CardsOpen[index] ? "rounded-t-xl" : "rounded-xl"}`}
                  id={`home-week2-slot-${index}-heading`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setWeek2CardsOpen((prev) => {
                        const next = [...prev];
                        next[index] = !next[index];
                        return next;
                      })
                    }
                    className="flex min-w-0 cursor-pointer items-center justify-center gap-4 text-left transition-opacity hover:opacity-90"
                    aria-expanded={week2CardsOpen[index]}
                    aria-controls={`home-week2-slot-${index}-body`}
                    aria-label={week2CardsOpen[index] ? "Collapse" : "Expand"}
                  >
                    <h2 className="min-w-0 truncate text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                      {getLocationName(key)}
                    </h2>
                    <span className="shrink-0 text-blue-100/80" aria-hidden>
                      {week2CardsOpen[index] ? "▼" : "▶"}
                    </span>
                  </button>
                  {hasLinkedPoolhubPlayer &&
                    tournamentInProgress &&
                    getMyMatchInWeek2Card(index) !== null &&
                    (getMyWeek2MatchStatusRaw(index) === "Paused" ||
                      getMyWeek2MatchStatusRaw(index) === "Paused..." ||
                      !bracketMatchStatusIsCompleted(getMyWeek2MatchStatusRaw(index))) && (
                      <div className="w-full pb-2">
                        <div className="flex w-full">
                          {!bracketMatchStatusIsCompleted(getMyWeek2MatchStatusRaw(index)) &&
                            (getMyWeek2MatchStatusRaw(index) === "Paused" ||
                            getMyWeek2MatchStatusRaw(index) === "Paused..." ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const matchIndex = getMyMatchInWeek2Card(index);
                                  if (matchIndex === null) return;
                                  router.push(
                                    `/live-scoring?stage=week2&card=${index}&match=${matchIndex}`
                                  );
                                }}
                                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                              >
                                Resume Match
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const matchIndex = getMyMatchInWeek2Card(index);
                                  if (matchIndex === null) return;
                                  handleWeek2BracketMatchClick(index, matchIndex);
                                }}
                                className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                              >
                                Live Score My Match
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-3 text-sm font-medium text-blue-100/90">
                    <span className="text-left">Week 2</span>
                    <span className="text-center">
                      {formatLocationDate(getLocationStartDate(key)) || "—"}
                    </span>
                    <span className="text-right">
                      {formatLocationTime(getLocationStartTime(key)) || "—"}
                    </span>
                  </div>
                </div>
                {week2CardsOpen[index] ? (
                  <div
                    id={`home-week2-slot-${index}-body`}
                    aria-labelledby={`home-week2-slot-${index}-heading`}
                    className="min-h-0 overflow-auto rounded-b-xl border-t border-white/40 bg-black pb-4 pt-4 pl-4"
                  >
                    <Bracket4
                      players={playerDisplayNames}
                      playerRaceToMap={playerRaceToMap}
                      initialSlotSelections={(() => {
                        const base = index * 6;
                        let byeNum = 0;
                        return Array.from({ length: 6 }, (_, i) => {
                          const val = week2BracketSlotsArray[base + i] ?? "";
                          if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                          return val;
                        });
                      })()}
                      initialScores={week2BracketScoresArray.slice(index * 6, index * 6 + 6)}
                      disabled
                      placeholderText="TBD..."
                      matchStatusByIndex={getWeek2MatchStatusByIndex(index)}
                      onMatchClickByIndex={(matchIndex) =>
                        handleWeek2BracketMatchClick(index, matchIndex)
                      }
                      matchForfeitingPlayerByMatchIndex={week2MatchForfeitsArray.slice(
                        index * 3,
                        index * 3 + 3
                      )}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex w-max min-w-0 flex-col gap-6">
            <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
              Finals
            </h2>
            <div className="w-full min-w-0 max-w-[600px] overflow-hidden rounded-xl border border-white/40 bg-black text-foreground sm:min-w-[555px]">
              <div
                className={`flex min-h-14 w-full flex-shrink-0 flex-col gap-1 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4 ${finalsCardOpen ? "rounded-t-xl" : "rounded-xl"}`}
                id="home-finals-slot-heading"
              >
                <button
                  type="button"
                  onClick={() => setFinalsCardOpen((prev) => !prev)}
                  className="flex min-w-0 cursor-pointer items-center justify-center gap-4 text-left transition-opacity hover:opacity-90"
                  aria-expanded={finalsCardOpen}
                  aria-controls="home-finals-slot-body"
                  aria-label={finalsCardOpen ? "Collapse" : "Expand"}
                >
                  <h2 className="min-w-0 truncate text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                    {getLocationName(FINALS_LOCATION_KEY)}
                  </h2>
                  <span className="shrink-0 text-blue-100/80" aria-hidden>
                    {finalsCardOpen ? "▼" : "▶"}
                  </span>
                </button>
                {hasLinkedPoolhubPlayer &&
                  tournamentInProgress &&
                  getMyMatchInFinals() !== null &&
                  (getMyFinalsMatchStatusRaw() === "Paused" ||
                    getMyFinalsMatchStatusRaw() === "Paused..." ||
                    !bracketMatchStatusIsCompleted(getMyFinalsMatchStatusRaw())) && (
                    <div className="w-full pb-2">
                      <div className="flex w-full">
                        {!bracketMatchStatusIsCompleted(getMyFinalsMatchStatusRaw()) &&
                          (getMyFinalsMatchStatusRaw() === "Paused" ||
                          getMyFinalsMatchStatusRaw() === "Paused..." ? (
                            <button
                              type="button"
                              onClick={() => {
                                const matchIndex = getMyMatchInFinals();
                                if (matchIndex === null) return;
                                router.push(
                                  `/live-scoring?stage=finals&card=0&match=${matchIndex}`
                                );
                              }}
                              className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                              Resume Match
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const matchIndex = getMyMatchInFinals();
                                if (matchIndex === null) return;
                                handleFinalsBracketMatchClick(matchIndex);
                              }}
                              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                              Live Score My Match
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-3 text-sm font-medium text-blue-100/90">
                  <span className="text-left">Finals</span>
                  <span className="text-center">
                    {formatLocationDate(getLocationStartDate(FINALS_LOCATION_KEY)) || "—"}
                  </span>
                  <span className="text-right">
                    {formatLocationTime(getLocationStartTime(FINALS_LOCATION_KEY)) || "—"}
                  </span>
                </div>
              </div>
              {finalsCardOpen ? (
                <div
                  id="home-finals-slot-body"
                  aria-labelledby="home-finals-slot-heading"
                  className="min-h-0 overflow-auto rounded-b-xl border-t border-white/40 bg-black pb-4 pt-4 pl-4"
                >
                  <Bracket4
                    players={playerDisplayNames}
                    playerRaceToMap={playerRaceToMap}
                    initialSlotSelections={(() => {
                      let byeNum = 0;
                      return finalsBracketSlotsArray.map((val) => {
                        if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                        return val;
                      });
                    })()}
                    initialScores={finalsBracketScoresArray}
                    disabled
                    placeholderText="TBD..."
                    matchStatusByIndex={getFinalsMatchStatusByIndex()}
                    onMatchClickByIndex={(matchIndex) =>
                      handleFinalsBracketMatchClick(matchIndex)
                    }
                    matchForfeitingPlayerByMatchIndex={finalsMatchForfeitsArray}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
