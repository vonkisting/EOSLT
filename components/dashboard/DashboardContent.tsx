"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Bracket8TwoRounds } from "@/components/Bracket8TwoRounds";
import { Bracket4 } from "@/components/Bracket4";
import { isBye } from "@/components/Bracket8TwoRounds";
import { Modal } from "@/components/ui/Modal";
import { formatLocationDate, formatLocationTime } from "@/lib/formatDateTime";
import { selectOptionsFullPool } from "@/lib/dropdownOptions";
import { deriveMatchStatusForRaceCellStyle } from "@/lib/bracketMatchRaceStyle";
import { canAccessDashboard } from "@/lib/dashboard-access";
import {
  FINALS_MATCH_FORFEIT_COUNT,
  parseMatchForfeitsJson,
  WEEK1_MATCH_FORFEIT_COUNT,
  WEEK2_MATCH_FORFEIT_COUNT,
} from "@/lib/matchForfeitsJson";
import { bracket4TargetSlotForWinner } from "@/lib/bracketMatchAdvance";
import { parseFinalsBracketMatchStatusesJson } from "@/lib/finalsBracketMatchStatuses";
import {
  parseWeek2BracketMatchStatusesJson,
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
  week2SlotPairIndices,
} from "@/lib/week2BracketSlots";

const PLAYER_SLOTS = 64;
const BYE_LABEL = "-- Bye --";

const LOCATION_KEYS = [
  "firstWeekLocation1", "firstWeekLocation2", "firstWeekLocation3", "firstWeekLocation4",
  "firstWeekLocation5", "firstWeekLocation6", "firstWeekLocation7", "firstWeekLocation8",
  "secondWeekLocation1", "secondWeekLocation2", "secondWeekLocation3", "secondWeekLocation4",
  "finalsLocation",
] as const;
type LocationKey = (typeof LOCATION_KEYS)[number];

const WEEK_1_KEYS: readonly LocationKey[] = [
  "firstWeekLocation1", "firstWeekLocation2", "firstWeekLocation3", "firstWeekLocation4",
  "firstWeekLocation5", "firstWeekLocation6", "firstWeekLocation7", "firstWeekLocation8",
];
const WEEK_2_KEYS: readonly LocationKey[] = [
  "secondWeekLocation1", "secondWeekLocation2", "secondWeekLocation3", "secondWeekLocation4",
];

/** Every venue is listed in each location dropdown (same venue may be chosen in multiple slots). */
function venueOptionsFor(
  key: LocationKey,
  locations: Record<LocationKey, string>,
  venueNames: string[]
): string[] {
  if (venueNames.length === 0) return [];
  return selectOptionsFullPool(venueNames, locations[key] ?? "");
}

const LOCATION_LABELS: Record<LocationKey, string> = {
  firstWeekLocation1: "Location 1",
  firstWeekLocation2: "Location 2",
  firstWeekLocation3: "Location 3",
  firstWeekLocation4: "Location 4",
  firstWeekLocation5: "Location 5",
  firstWeekLocation6: "Location 6",
  firstWeekLocation7: "Location 7",
  firstWeekLocation8: "Location 8",
  secondWeekLocation1: "Location 1",
  secondWeekLocation2: "Location 2",
  secondWeekLocation3: "Location 3",
  secondWeekLocation4: "Location 4",
  finalsLocation: "Location",
};

type PlayerFromApi = {
  FirstName: string;
  LastName: string;
  Weeks: number | null;
  LegacyAve: number | null;
  Team: string | null;
};

type PlayerTableRow = {
  playerName: string;
  weeks: number | null;
  legacyAve: number | null;
  raceTo: number | null;
  teamName: string | null;
};

type OverallPlayerStatsRow = Record<string, string | number | null | undefined>;

/** Read a value from an OverallPlayerStats row trying common column name variants (DB casing may differ). */
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

function toTeamName(val: string | number | null | undefined): string | null {
  if (val == null) return null;
  const team = String(val).trim();
  return team !== "" ? team : null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function canShareFirstRoundMatchup(
  top: string,
  bottom: string,
  teamByPlayer: Map<string, string | null>
): boolean {
  if (isBye(top) && isBye(bottom)) return false;
  if (isBye(top) || isBye(bottom)) return true;
  const topTeam = teamByPlayer.get(top) ?? null;
  const bottomTeam = teamByPlayer.get(bottom) ?? null;
  if (!topTeam || !bottomTeam) return true;
  return topTeam !== bottomTeam;
}

/** True if two or more non-bye players in this 8-slot bracket share the same team (normalized key). */
function bracketHasDuplicateTeamAtLocation(
  bracket: string[],
  teamByPlayer: Map<string, string | null>
): boolean {
  const seen = new Set<string>();
  for (const name of bracket) {
    if (isBye(name)) continue;
    const t = teamByPlayer.get(name) ?? null;
    if (!t) continue;
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
}

type TeammateLocationConflict = {
  locationLabel: string;
  teamLabel: string;
  players: string[];
};

/** Success modal: "Name (Team)" with em dash when no team; byes unchanged. */
function formatDrawModalPlayerWithTeam(name: string, rows: PlayerTableRow[]): string {
  if (isBye(name)) return name;
  const row = rows.find((r) => r.playerName === name && !isBye(r.playerName));
  const team = row?.teamName?.trim();
  const teamPart = team && team !== "" ? team : "—";
  return `${name} (${teamPart})`;
}

function buildTeamDisplayByKey(rows: PlayerTableRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of rows) {
    if (isBye(row.playerName)) continue;
    const raw = row.teamName?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (!m.has(key)) m.set(key, raw);
  }
  return m;
}

function computeTeammateLocationConflicts(
  cards: string[][],
  teamByPlayer: Map<string, string | null>,
  teamDisplayByKey: Map<string, string>
): TeammateLocationConflict[] {
  const out: TeammateLocationConflict[] = [];
  for (let bracketIndex = 0; bracketIndex < 8; bracketIndex++) {
    const firstRound = (cards[bracketIndex] ?? []).slice(0, 8);
    const byTeam = new Map<string, string[]>();
    for (const name of firstRound) {
      if (isBye(name)) continue;
      const tk = teamByPlayer.get(name) ?? null;
      if (!tk) continue;
      const list = byTeam.get(tk) ?? [];
      list.push(name);
      byTeam.set(tk, list);
    }
    for (const [teamKey, players] of byTeam) {
      if (players.length > 1) {
        out.push({
          locationLabel: LOCATION_LABELS[WEEK_1_KEYS[bracketIndex]],
          teamLabel: teamDisplayByKey.get(teamKey) ?? teamKey,
          players: [...players].sort((a, b) => a.localeCompare(b)),
        });
      }
    }
  }
  out.sort((a, b) =>
    a.locationLabel.localeCompare(b.locationLabel) || a.teamLabel.localeCompare(b.teamLabel)
  );
  return out;
}

/** Each entry is one team that has 2+ members at the same Week 1 location. */
function countTeammateSameLocationInstances(
  cards: string[][],
  teamByPlayer: Map<string, string | null>,
  teamDisplayByKey: Map<string, string>
): number {
  return computeTeammateLocationConflicts(cards, teamByPlayer, teamDisplayByKey).length;
}

const MAX_TEAMMATE_LOCATION_RETRY_ROUNDS = 1000;
/** Accept bracket only when there are no teammate same-location overlaps (reject when > 0). */
const MAX_TEAMMATE_LOCATION_INSTANCES_ALLOWED = 0;

type Week1DrawMatchupLine = { top: string; bottom: string };

type Week1DrawLocationBlock = {
  locationLabel: string;
  matchups: Week1DrawMatchupLine[];
};

type RandomizeWeek1SuccessModalPayload = {
  teammateConflicts: TeammateLocationConflict[];
  locations: Week1DrawLocationBlock[];
};

function buildRandomizeWeek1SuccessModalPayload(
  cards: string[][],
  teamByPlayer: Map<string, string | null>,
  teamDisplayByKey: Map<string, string>,
  rows: PlayerTableRow[]
): RandomizeWeek1SuccessModalPayload {
  const teammateConflicts = computeTeammateLocationConflicts(
    cards,
    teamByPlayer,
    teamDisplayByKey
  );
  const locations: Week1DrawLocationBlock[] = Array.from({ length: 8 }, (_, bracketIndex) => {
    const firstRound = (cards[bracketIndex] ?? []).slice(0, 8);
    const matchups: Week1DrawMatchupLine[] = [];
    for (let p = 0; p < 8; p += 2) {
      const top = firstRound[p] ?? "";
      const bottom = firstRound[p + 1] ?? "";
      matchups.push({
        top: formatDrawModalPlayerWithTeam(top, rows),
        bottom: formatDrawModalPlayerWithTeam(bottom, rows),
      });
    }
    return { locationLabel: LOCATION_LABELS[WEEK_1_KEYS[bracketIndex]], matchups };
  });
  return { teammateConflicts, locations };
}

function tryRandomizeWeek1Slots(
  rows: PlayerTableRow[],
  playerSlotCount: number,
  avoidTeammatesSameLocation: boolean
): string[][] | null {
  let byeNumber = 0;
  const participants = rows.slice(0, playerSlotCount).map((row) => {
    if (isBye(row.playerName)) {
      byeNumber += 1;
      return `-- Bye ${byeNumber} --`;
    }
    return row.playerName;
  });
  const teamByPlayer = new Map(
    rows
      .filter((row) => !isBye(row.playerName))
      .map((row) => [row.playerName, row.teamName?.toLowerCase().trim() ?? null] as const)
  );

  for (let attempt = 0; attempt < 20000; attempt++) {
    const shuffled = shuffleArray(participants);
    let valid = true;

    for (let bracketIndex = 0; bracketIndex < 8 && valid; bracketIndex++) {
      const bracket = shuffled.slice(bracketIndex * 8, bracketIndex * 8 + 8);
      const byeCount = bracket.filter((name) => isBye(name)).length;
      if (byeCount > 1) {
        valid = false;
        break;
      }
      if (
        avoidTeammatesSameLocation &&
        bracketHasDuplicateTeamAtLocation(bracket, teamByPlayer)
      ) {
        valid = false;
        break;
      }
      for (let slot = 0; slot < 8; slot += 2) {
        if (!canShareFirstRoundMatchup(bracket[slot] ?? "", bracket[slot + 1] ?? "", teamByPlayer)) {
          valid = false;
          break;
        }
      }
    }

    if (valid) {
      return Array.from({ length: 8 }, (_, bracketIndex) => {
        const firstRound = shuffled.slice(bracketIndex * 8, bracketIndex * 8 + 8);
        const secondRound = Array.from({ length: 4 }, (_, pairIndex) => {
          const top = firstRound[pairIndex * 2] ?? "";
          const bottom = firstRound[pairIndex * 2 + 1] ?? "";
          if (isBye(top) && !isBye(bottom)) return bottom;
          if (!isBye(top) && isBye(bottom)) return top;
          return "";
        });
        return [...firstRound, ...secondRound];
      });
    }
  }

  return null;
}

export function DashboardContent() {
  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase().trim();
  const router = useRouter();
  const savedSettings = useQuery(api.dashboardSettings.getShared, {});
  /** Tournament/bracket data and shared writes (canonical doc). */
  const setDashboardSettings = useMutation(api.dashboardSettings.setShared);
  const hasAppliedInitialSettings = useRef(false);
  const settingsQueryHasReturned = useRef(false);

  const [leagueNames, setLeagueNames] = useState<string[]>([]);
  const [selectedLeagueName, setSelectedLeagueName] = useState<string>("");
  const [seasonNames, setSeasonNames] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const pendingSeasonFromSettings = useRef<string | null>(null);
  const [selectedLeagueGuid, setSelectedLeagueGuid] = useState<string | null>(null);
  const [overallPlayerStats, setOverallPlayerStats] = useState<OverallPlayerStatsRow[]>([]);
  const [playersFromApi, setPlayersFromApi] = useState<PlayerFromApi[]>([]);
  const [loadingOverallStats, setLoadingOverallStats] = useState(false);
  const [playerRows, setPlayerRows] = useState<PlayerTableRow[]>(
    Array(PLAYER_SLOTS).fill(null).map(() => ({
      playerName: BYE_LABEL,
      weeks: null,
      legacyAve: null,
      raceTo: null,
      teamName: null,
    }))
  );
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [leagueLoadError, setLeagueLoadError] = useState<string | null>(null);
  const [bracketResetKey, setBracketResetKey] = useState(0);
  const [resetBracketsModalOpen, setResetBracketsModalOpen] = useState(false);
  const [resetLocationsModalOpen, setResetLocationsModalOpen] = useState(false);
  const [randomizeBracketModalOpen, setRandomizeBracketModalOpen] = useState(false);
  const [resetTournamentModalOpen, setResetTournamentModalOpen] = useState(false);
  const [randomizeBracketError, setRandomizeBracketError] = useState<string | null>(null);
  const [randomizeTooManyAttemptsOpen, setRandomizeTooManyAttemptsOpen] = useState(false);
  /** Proposed Week 1 card slot data; saved to Convex only after user clicks Accept in the preview modal. */
  const [pendingWeek1RandomizeCards, setPendingWeek1RandomizeCards] = useState<string[][] | null>(
    null
  );
  const [isRandomizingBracket, setIsRandomizingBracket] = useState(false);

  /** Player list with byes numbered as "-- Bye 1 --", "-- Bye 2 --", etc. for display and bracket. */
  const playerDisplayNames = useMemo(() => {
    let byeNum = 0;
    return playerRows.map((r) =>
      r.playerName === BYE_LABEL ? `-- Bye ${++byeNum} --` : r.playerName
    );
  }, [playerRows]);

  const playerTeamMap = useMemo(
    () =>
      new Map(
        playersFromApi.map((player) => [
          `${player.FirstName ?? ""} ${player.LastName ?? ""}`.trim(),
          toTeamName(player.Team),
        ])
      ),
    [playersFromApi]
  );

  const pendingWeek1RandomizeModalPayload = useMemo((): RandomizeWeek1SuccessModalPayload | null => {
    if (!pendingWeek1RandomizeCards) return null;
    const teamByPlayer = new Map(
      playerRows
        .filter((row) => !isBye(row.playerName))
        .map((row) => [row.playerName, row.teamName?.toLowerCase().trim() ?? null] as const)
    );
    const teamDisplayByKey = buildTeamDisplayByKey(playerRows);
    return buildRandomizeWeek1SuccessModalPayload(
      pendingWeek1RandomizeCards,
      teamByPlayer,
      teamDisplayByKey,
      playerRows
    );
  }, [pendingWeek1RandomizeCards, playerRows]);

  /** First-round slot values for all 8 Week 1 cards (8×8=64). Used for overlap checks and bracket props. */
  const allFirstRoundSelections = useMemo(() => {
    if (!savedSettings || typeof savedSettings !== "object") {
      return Array(64).fill("") as string[];
    }
    const out: string[] = [];
    for (let c = 0; c < 8; c++) {
      for (let i = 0; i < 8; i++) {
        const key = `bracketSlot${c * 12 + i}`;
        const v = (savedSettings as Record<string, unknown>)[key];
        out.push(typeof v === "string" ? v : "");
      }
    }
    return out;
  }, [savedSettings]);

  /**
   * Count of “teammates at same Week 1 location”: each team that has 2+ players in the same
   * 8-player first-round block (one card) counts once per location.
   */
  const week1TeammateLocationOverlapCount = useMemo(() => {
    const cards = Array.from({ length: 8 }, (_, c) =>
      Array.from({ length: 8 }, (_, i) => allFirstRoundSelections[c * 8 + i]?.trim() ?? "")
    );
    const teamByPlayer = new Map(
      playerRows
        .filter((row) => !isBye(row.playerName))
        .map(
          (row) =>
            [row.playerName, row.teamName?.toLowerCase().trim() ?? null] as [
              string,
              string | null,
            ]
        )
    );
    const teamDisplayByKey = buildTeamDisplayByKey(playerRows);
    return countTeammateSameLocationInstances(cards, teamByPlayer, teamDisplayByKey);
  }, [allFirstRoundSelections, playerRows]);

  /** True when all 64 first-round slots (8 cards × 8 slots) have a selected player name. */
  const allFirstRoundFilled = useMemo(() => {
    return allFirstRoundSelections.every((v) => typeof v === "string" && v.trim() !== "");
  }, [allFirstRoundSelections]);

  /** True when any Week 1 first-round bracket slot has a selected player name. */
  const anyFirstRoundFilled = useMemo(() => {
    return allFirstRoundSelections.some((v) => typeof v === "string" && v.trim() !== "");
  }, [allFirstRoundSelections]);

  /** Week 2 bracket slots: 4 cards × 6 (4-person). Parsed from week2BracketSlots JSON (migrates legacy 48). */
  const week2BracketSlotsArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).week2BracketSlots
        : undefined;
    return parseWeek2BracketSlotsJson(raw);
  }, [savedSettings]);

  const week2BracketScoresArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).week2BracketScores
        : undefined;
    return parseWeek2BracketScoresJson(raw);
  }, [savedSettings]);

  const week2BracketMatchStatusesArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).week2BracketMatchStatuses
        : undefined;
    return parseWeek2BracketMatchStatusesJson(raw);
  }, [savedSettings]);

  /** Finals bracket slots: 6 (2 semis + 1 final). Parsed from savedSettings.finalsBracketSlots JSON. */
  const finalsBracketSlotsArray = useMemo(() => {
    const raw = savedSettings && typeof savedSettings === "object"
      ? (savedSettings as Record<string, unknown>).finalsBracketSlots
      : undefined;
    if (typeof raw !== "string" || !raw.trim()) return Array(6).fill("") as string[];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 6) return Array(6).fill("") as string[];
      return arr.map((v) => (typeof v === "string" ? v : ""));
    } catch {
      return Array(6).fill("") as string[];
    }
  }, [savedSettings]);

  /** Finals bracket scores: 6 (same order as slots). Parsed from savedSettings.finalsBracketScores JSON. */
  const finalsBracketScoresArray = useMemo(() => {
    const raw = savedSettings && typeof savedSettings === "object"
      ? (savedSettings as Record<string, unknown>).finalsBracketScores
      : undefined;
    if (typeof raw !== "string" || !raw.trim()) return Array(6).fill("0") as string[];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 6) return Array(6).fill("0") as string[];
      return arr.map((v) => (typeof v === "string" ? v : "0"));
    } catch {
      return Array(6).fill("0") as string[];
    }
  }, [savedSettings]);

  const finalsBracketMatchStatusesArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).finalsBracketMatchStatuses
        : undefined;
    return parseFinalsBracketMatchStatusesJson(raw);
  }, [savedSettings]);

  const week1MatchForfeitsArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).week1MatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, WEEK1_MATCH_FORFEIT_COUNT);
  }, [savedSettings]);

  const week2MatchForfeitsArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).week2MatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, WEEK2_MATCH_FORFEIT_COUNT);
  }, [savedSettings]);

  const finalsMatchForfeitsArray = useMemo(() => {
    const raw =
      savedSettings && typeof savedSettings === "object"
        ? (savedSettings as Record<string, unknown>).finalsMatchForfeits
        : undefined;
    return parseMatchForfeitsJson(raw, FINALS_MATCH_FORFEIT_COUNT);
  }, [savedSettings]);

  /** Champion of the Finals bracket: winner of the final match (slots 4 vs 5 by score), or null if no winner yet. */
  const finalsChampion = useMemo(() => {
    const slots = finalsBracketSlotsArray;
    const scores = finalsBracketScoresArray;
    const topScore = Number(scores[4]);
    const bottomScore = Number(scores[5]);
    const topName = (slots[4] ?? "").trim();
    const bottomName = (slots[5] ?? "").trim();
    if (!topName || !bottomName || isBye(topName) || isBye(bottomName)) return null;
    if (Number.isNaN(topScore) || Number.isNaN(bottomScore)) return null;
    if (topScore > bottomScore) return topName;
    if (bottomScore > topScore) return bottomName;
    return null;
  }, [finalsBracketSlotsArray, finalsBracketScoresArray]);

  const getMatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!savedSettings || typeof savedSettings !== "object") return Array(6).fill(null);
      const s = savedSettings as Record<string, unknown>;
      return Array.from({ length: 6 }, (_, i) => {
        const globalIdx = cardIndex * 6 + i;
        const rawStatus = ((s[`bracketMatchStatus${globalIdx}`] as string) ?? "").trim() || null;
        const liveJson = s[`liveScoreGames${globalIdx}`] as string | undefined;
        return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
      });
    },
    [savedSettings]
  );

  const getWeek2MatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!savedSettings || typeof savedSettings !== "object") return Array(3).fill(null);
      const s = savedSettings as Record<string, unknown>;
      return Array.from({ length: 3 }, (_, i) => {
        const val = week2BracketMatchStatusesArray[cardIndex * 3 + i] ?? "";
        const rawStatus = val.trim() || null;
        const gk = 48 + cardIndex * 3 + i;
        const liveJson = s[`liveScoreGames${gk}`] as string | undefined;
        return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
      });
    },
    [savedSettings, week2BracketMatchStatusesArray]
  );

  const getFinalsMatchStatusByIndex = useCallback((): (string | null)[] => {
    if (!savedSettings || typeof savedSettings !== "object") return Array(3).fill(null);
    const s = savedSettings as Record<string, unknown>;
    return Array.from({ length: 3 }, (_, i) => {
      const val = finalsBracketMatchStatusesArray[i] ?? "";
      const rawStatus = val.trim() || null;
      const gk = 60 + i;
      const liveJson = s[`liveScoreGames${gk}`] as string | undefined;
      return deriveMatchStatusForRaceCellStyle(rawStatus, liveJson);
    });
  }, [savedSettings, finalsBracketMatchStatusesArray]);

  const tournamentStarted =
    (savedSettings && typeof savedSettings === "object" && (savedSettings as Record<string, unknown>).tournamentStarted === true) ?? false;
  const tournamentPaused =
    (savedSettings && typeof savedSettings === "object" && (savedSettings as Record<string, unknown>).tournamentPaused === true) ?? false;
  /** Venue + start date/time: editable before start or while paused; locked only during active play. */
  const lockLocationScheduleFields = tournamentStarted && !tournamentPaused;
  const week1BracketsRandomized =
    (savedSettings &&
      typeof savedSettings === "object" &&
      (savedSettings as Record<string, unknown>).week1BracketsRandomized === true) ?? false;
  const showBracketsOnHomeScreen =
    (savedSettings &&
      typeof savedSettings === "object" &&
      (savedSettings as Record<string, unknown>).showBracketsOnHomeScreen === true) ?? false;

  const [locations, setLocations] = useState<Record<LocationKey, string>>(() =>
    Object.fromEntries(LOCATION_KEYS.map((k) => [k, ""])) as Record<LocationKey, string>
  );
  const [locationStartDates, setLocationStartDates] = useState<Record<LocationKey, string>>(() =>
    Object.fromEntries(LOCATION_KEYS.map((k) => [k, ""])) as Record<LocationKey, string>
  );
  const [locationStartTimes, setLocationStartTimes] = useState<Record<LocationKey, string>>(() =>
    Object.fromEntries(LOCATION_KEYS.map((k) => [k, ""])) as Record<LocationKey, string>
  );
  const venueList = useQuery(api.venues.list, {});
  const venueNames = Array.isArray(venueList) ? venueList : [];
  const loadingVenues = venueList === undefined;
  const hasTriggeredVenueSyncRef = useRef(false);
  const [syncingVenuesFromPoolHub, setSyncingVenuesFromPoolHub] = useState(false);
  const [venueSyncError, setVenueSyncError] = useState<string | null>(null);
  const venuesLoading = loadingVenues || syncingVenuesFromPoolHub;

  /** True when all location dropdowns (Week 1, Week 2, Finals) have a value. */
  const allLocationsFilled = useMemo(
    () => LOCATION_KEYS.every((key) => (locations[key] ?? "").trim() !== ""),
    [locations]
  );

  /** True when all Week 1 location dropdowns have a value. */
  const allWeek1LocationsFilled = useMemo(
    () => WEEK_1_KEYS.every((key) => (locations[key] ?? "").trim() !== ""),
    [locations]
  );

  /** True when any Week 1 location dropdown has a value. */
  const anyWeek1LocationsFilled = useMemo(
    () => WEEK_1_KEYS.some((key) => (locations[key] ?? "").trim() !== ""),
    [locations]
  );

  /** Message explaining what blocks Start Tournament, or null when ready. */
  const startTournamentHintMessage = useMemo(() => {
    if (!selectedLeagueName?.trim()) return "Select a league.";
    if (!selectedSeason?.trim()) return "Select a season.";
    return null;
  }, [selectedLeagueName, selectedSeason]);

  const usersList = useQuery(api.users.list, {});
  const deleteUserMutation = useMutation(api.users.deleteUser);
  const setPoolhubPlayerNameMutation = useMutation(api.users.setPoolhubPlayerName);
  const [userToDelete, setUserToDelete] = useState<{
    _id: Id<"users">;
    email: string;
    name: string | null;
  } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<Id<"users"> | null>(null);
  const [userToUnlink, setUserToUnlink] = useState<{
    email: string;
    name: string | null;
    poolhubPlayerName: string;
  } | null>(null);
  const [unlinkingEmail, setUnlinkingEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leagues")
      .then((r) => r.json().then((data: { leagues?: string[]; error?: string } | string[]) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (Array.isArray(data)) {
          setLeagueNames(data);
          setLeagueLoadError(ok ? null : "Failed to load leagues.");
        } else {
          setLeagueNames(data?.leagues ?? []);
          setLeagueLoadError(data?.error ?? (ok ? null : "Failed to load leagues."));
        }
        setLoadingLeagues(false);
      })
      .catch(() => {
        setLeagueLoadError("Failed to load leagues.");
        setLoadingLeagues(false);
      });
  }, []);

  useEffect(() => {
    if (venueList === undefined || venueNames.length > 0 || hasTriggeredVenueSyncRef.current) return;
    hasTriggeredVenueSyncRef.current = true;
    setSyncingVenuesFromPoolHub(true);
    setVenueSyncError(null);
    fetch("/api/sync-venues", { method: "POST" })
      .then((r) => r.json().catch(() => ({})))
      .then((body: { ok?: boolean; error?: string; message?: string }) => {
        setSyncingVenuesFromPoolHub(false);
        if (body?.ok !== true && body?.error) setVenueSyncError(body.error);
      })
      .catch(() => {
        setSyncingVenuesFromPoolHub(false);
        setVenueSyncError("Failed to load venues from database.");
      });
  }, [venueList, venueNames.length]);

  useEffect(() => {
    if (savedSettings !== undefined) settingsQueryHasReturned.current = true;
  }, [savedSettings]);

  useEffect(() => {
    if (hasAppliedInitialSettings.current || savedSettings == null) return;
    const { leagueName, season, leagueGuid, ...rest } = savedSettings;
    const leagueNameStr = typeof leagueName === "string" ? leagueName.trim() : "";
    const seasonStr = typeof season === "string" ? season.trim() : "";
    if (!leagueNameStr) return;
    if (leagueNames.length > 0 && !leagueNames.includes(leagueNameStr)) return;
    hasAppliedInitialSettings.current = true;
    setSelectedLeagueName(leagueNameStr);
    if (seasonStr) setSelectedSeason(seasonStr);
    pendingSeasonFromSettings.current = seasonStr || null;
    if (leagueGuid) setSelectedLeagueGuid(leagueGuid);
    const locUpdate: Partial<Record<LocationKey, string>> = {};
    for (const key of LOCATION_KEYS) {
      const v = (rest as Record<string, unknown>)[key];
      if (typeof v === "string") locUpdate[key] = v;
    }
    if (Object.keys(locUpdate).length) setLocations((prev) => ({ ...prev, ...locUpdate }));
    const metaRaw = (rest as Record<string, unknown>).locationStartMeta;
    if (typeof metaRaw === "string" && metaRaw.trim() !== "") {
      try {
        const meta = JSON.parse(metaRaw) as Record<string, { startDate?: string; startTime?: string }>;
        const dateUpdate: Partial<Record<LocationKey, string>> = {};
        const timeUpdate: Partial<Record<LocationKey, string>> = {};
        for (const key of LOCATION_KEYS) {
          const entry = meta[key];
          if (entry && typeof entry === "object") {
            if (typeof entry.startDate === "string") dateUpdate[key] = entry.startDate;
            if (typeof entry.startTime === "string") timeUpdate[key] = entry.startTime;
          }
        }
        if (Object.keys(dateUpdate).length) setLocationStartDates((prev) => ({ ...prev, ...dateUpdate }));
        if (Object.keys(timeUpdate).length) setLocationStartTimes((prev) => ({ ...prev, ...timeUpdate }));
      } catch {
        /* ignore invalid JSON */
      }
    }
  }, [savedSettings, leagueNames]);

  useEffect(() => {
    if (pendingSeasonFromSettings.current == null || !seasonNames.length) return;
    const pending = pendingSeasonFromSettings.current;
    pendingSeasonFromSettings.current = null;
    if (seasonNames.includes(pending)) setSelectedSeason(pending);
  }, [seasonNames]);

  /** After a reset, when user has saved new slot selections, stop forcing empty initialSlotSelections */
  useEffect(() => {
    if (bracketResetKey === 0 || !savedSettings) return;
    const hasAnySlot = Array.from({ length: 96 }, (_, i) =>
      (savedSettings as Record<string, unknown>)[`bracketSlot${i}`]
    ).some((v) => v != null && v !== "");
    if (hasAnySlot) setBracketResetKey(0);
  }, [bracketResetKey, savedSettings]);

  const locationStartMetaJson = useMemo(() => {
    const meta: Record<string, { startDate: string; startTime: string }> = {};
    for (const key of LOCATION_KEYS) {
      meta[key] = {
        startDate: locationStartDates[key] ?? "",
        startTime: locationStartTimes[key] ?? "",
      };
    }
    return JSON.stringify(meta);
  }, [locationStartDates, locationStartTimes]);

  /** Persist location start date/time to Convex immediately (e.g. on date/time input change). */
  const saveLocationStartMeta = useCallback(
    (metaJson: string) => {
      if (!email || !selectedLeagueName || !selectedSeason) return;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        ...locations,
        locationStartMeta: metaJson,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, locations, setDashboardSettings]
  );

  const saveLocations = useCallback(() => {
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      ...locations,
      locationStartMeta: locationStartMetaJson,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, locations, locationStartMetaJson, setDashboardSettings]);

  /** Slot indices for a matchup: matchIndex 0->0,1; 1->2,3; ...; 5->10,11. */
  const slotIndicesForMatch = useCallback((matchIndex: number): [number, number] => {
    const top = matchIndex < 4 ? matchIndex * 2 : 8 + (matchIndex - 4) * 2;
    return [top, top + 1];
  }, []);

  /** Right-click a Week 1 player name: open live scorecard (editable for operators; uses ?dashboard=1). */
  const onWeek1MatchNameContextMenu = useCallback(
    (cardIndex: number, matchIndex: number) => {
      if (!email || !savedSettings || typeof savedSettings !== "object") return;
      const s = savedSettings as Record<string, unknown>;
      const base = cardIndex * 12;
      const [topSlot, bottomSlot] = slotIndicesForMatch(matchIndex);
      const topVal = ((s[`bracketSlot${base + topSlot}`] as string) ?? "").trim();
      const bottomVal = ((s[`bracketSlot${base + bottomSlot}`] as string) ?? "").trim();
      const statusKey = `bracketMatchStatus${cardIndex * 6 + matchIndex}`;
      const stRaw = ((s[statusKey] as string) ?? "").trim();
      const st = stRaw || null;

      const qs = new URLSearchParams({
        card: String(cardIndex),
        match: String(matchIndex),
        dashboard: "1",
      });

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }

      if (st === "Completed") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }

      if (!topVal || !bottomVal) {
        qs.set("readonly", "1");
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }

      void setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        [statusKey]: "In Progress...",
      } as Parameters<typeof setDashboardSettings>[0]);
      router.push(`/live-scoring?${qs.toString()}`);
    },
    [
      email,
      savedSettings,
      slotIndicesForMatch,
      router,
      setDashboardSettings,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
    ]
  );

  /** Right-click a Week 2 player name: open live scorecard (same rules as Week 1; `stage=week2`). */
  const onWeek2MatchNameContextMenu = useCallback(
    (cardIndex: number, matchIndex: number) => {
      if (!email || !savedSettings || typeof savedSettings !== "object") return;
      const base = cardIndex * 6;
      const [topSlot, bottomSlot] = week2SlotPairIndices(matchIndex);
      const topVal = (week2BracketSlotsArray[base + topSlot] ?? "").trim();
      const bottomVal = (week2BracketSlotsArray[base + bottomSlot] ?? "").trim();
      const statusIdx = cardIndex * 3 + matchIndex;
      const stRaw = (week2BracketMatchStatusesArray[statusIdx] ?? "").trim();
      const st = stRaw || null;

      const qs = new URLSearchParams({
        stage: "week2",
        card: String(cardIndex),
        match: String(matchIndex),
        dashboard: "1",
      });

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }
      if (st === "Completed") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }
      if (!topVal || !bottomVal) {
        qs.set("readonly", "1");
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }

      const nextStatuses = [...week2BracketMatchStatusesArray];
      nextStatuses[statusIdx] = "In Progress...";
      void setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        week2BracketMatchStatuses: JSON.stringify(nextStatuses),
      } as Parameters<typeof setDashboardSettings>[0]);
      router.push(`/live-scoring?${qs.toString()}`);
    },
    [
      email,
      savedSettings,
      week2BracketSlotsArray,
      week2BracketMatchStatusesArray,
      router,
      setDashboardSettings,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
    ]
  );

  /** Right-click a Finals player name: open live scorecard (`stage=finals`, `card=0`). */
  const onFinalsMatchNameContextMenu = useCallback(
    (matchIndex: number) => {
      if (!email || !savedSettings || typeof savedSettings !== "object") return;
      const [topSlot, bottomSlot] = week2SlotPairIndices(matchIndex);
      const topVal = (finalsBracketSlotsArray[topSlot] ?? "").trim();
      const bottomVal = (finalsBracketSlotsArray[bottomSlot] ?? "").trim();
      const stRaw = (finalsBracketMatchStatusesArray[matchIndex] ?? "").trim();
      const st = stRaw || null;

      const qs = new URLSearchParams({
        stage: "finals",
        card: "0",
        match: String(matchIndex),
        dashboard: "1",
      });

      if (st === "Paused" || st === "Paused...") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }
      if (st === "Completed") {
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }
      if (!topVal || !bottomVal) {
        qs.set("readonly", "1");
        router.push(`/live-scoring?${qs.toString()}`);
        return;
      }

      const nextStatuses = [...finalsBracketMatchStatusesArray];
      nextStatuses[matchIndex] = "In Progress...";
      void setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        finalsBracketMatchStatuses: JSON.stringify(nextStatuses),
      } as Parameters<typeof setDashboardSettings>[0]);
      router.push(`/live-scoring?${qs.toString()}`);
    },
    [
      email,
      savedSettings,
      finalsBracketSlotsArray,
      finalsBracketMatchStatusesArray,
      router,
      setDashboardSettings,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
    ]
  );

  /** Save the 12 bracket player-name slots for one Week 1 card only; also sets matchup status to "Match Ready" when both players selected and status was empty. */
  const saveBracketSlots = useCallback(
    (cardIndex: number, slots: string[]) => {
      if (!email || slots.length !== 12 || cardIndex < 0 || cardIndex > 7) return;
      const base = cardIndex * 12;
      const slotEntries = Array.from({ length: 12 }, (_, i) => [
        `bracketSlot${base + i}`,
        slots[i] ?? "",
      ]);
      const statusEntries: [string, string][] = [];
      for (let m = 0; m < 6; m++) {
        const [top, bottom] = slotIndicesForMatch(m);
        const topVal = (slots[top] ?? "").trim();
        const bottomVal = (slots[bottom] ?? "").trim();
        if (topVal && bottomVal) {
          const statusKey = `bracketMatchStatus${cardIndex * 6 + m}`;
          const current = (savedSettings as Record<string, unknown>)?.[statusKey];
          const currentStr = typeof current === "string" ? current.trim() : "";
          statusEntries.push([statusKey, currentStr || "Match Ready"]);
        }
      }
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        ...Object.fromEntries(slotEntries),
        ...Object.fromEntries(statusEntries),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, savedSettings, slotIndicesForMatch, setDashboardSettings]
  );

  /** Save the 6 bracket slots for one Week 2 card (cardIndex 0–3). Persists week2BracketSlots + match statuses JSON. */
  const saveWeek2BracketSlots = useCallback(
    (cardIndex: number, slots: string[]) => {
      if (
        !email ||
        !selectedLeagueName?.trim() ||
        !selectedSeason?.trim() ||
        slots.length !== 6 ||
        cardIndex < 0 ||
        cardIndex > 3
      ) {
        return;
      }
      const next = [...week2BracketSlotsArray];
      for (let i = 0; i < 6; i++) next[cardIndex * 6 + i] = slots[i] ?? "";
      const nextStatuses = [...week2BracketMatchStatusesArray];
      for (let m = 0; m < 3; m++) {
        const [top, bottom] = week2SlotPairIndices(m);
        const topVal = (slots[top] ?? "").trim();
        const bottomVal = (slots[bottom] ?? "").trim();
        const idx = cardIndex * 3 + m;
        if (topVal && bottomVal) {
          const cur = (nextStatuses[idx] ?? "").trim();
          if (!cur) nextStatuses[idx] = "Match Ready";
        }
      }
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        week2BracketSlots: JSON.stringify(next),
        week2BracketMatchStatuses: JSON.stringify(nextStatuses),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [
      email,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
      week2BracketSlotsArray,
      week2BracketMatchStatusesArray,
      setDashboardSettings,
    ]
  );

  /** Save one Week 2 bracket score (matchIndex 0–2). Persists week2BracketScores JSON. */
  const saveWeek2ScoreChange = useCallback(
    (cardIndex: number, matchIndex: number, side: "top" | "bottom", value: string) => {
      if (!email || cardIndex < 0 || cardIndex > 3 || matchIndex < 0 || matchIndex > 2) return;
      const scoreIndex = cardIndex * 6 + matchIndex * 2 + (side === "top" ? 0 : 1);
      const next = [...week2BracketScoresArray];
      next[scoreIndex] = value;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        week2BracketScores: JSON.stringify(next),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [
      email,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
      week2BracketScoresArray,
      setDashboardSettings,
    ]
  );

  /** Save the 6 Finals bracket slots. Persists to finalsBracketSlots JSON + per-matchup statuses. */
  const saveFinalsBracketSlots = useCallback(
    (slots: string[]) => {
      if (!email || !selectedLeagueName?.trim() || !selectedSeason?.trim() || slots.length !== 6) return;
      const nextStatuses = [...finalsBracketMatchStatusesArray];
      for (let m = 0; m < 3; m++) {
        const [top, bottom] = week2SlotPairIndices(m);
        const topVal = (slots[top] ?? "").trim();
        const bottomVal = (slots[bottom] ?? "").trim();
        if (topVal && bottomVal) {
          const cur = (nextStatuses[m] ?? "").trim();
          if (!cur) nextStatuses[m] = "Match Ready";
        }
      }
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        finalsBracketSlots: JSON.stringify(slots),
        finalsBracketMatchStatuses: JSON.stringify(nextStatuses),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [
      email,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
      finalsBracketMatchStatusesArray,
      setDashboardSettings,
    ]
  );

  /** Save one Finals bracket score (matchIndex 0–2, side "top"|"bottom"). Persists to finalsBracketScores JSON. */
  const saveFinalsScoreChange = useCallback(
    (matchIndex: number, side: "top" | "bottom", value: string) => {
      if (!email || matchIndex < 0 || matchIndex > 2) return;
      const scoreIndex = matchIndex * 2 + (side === "top" ? 0 : 1);
      const next = [...finalsBracketScoresArray];
      next[scoreIndex] = value;
      const patch = {
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        finalsBracketScores: JSON.stringify(next),
      } as Parameters<typeof setDashboardSettings>[0];

      /** Semifinals (match 0–1): push winner into championship matchup slots 4–5 (same as live scoring submit). */
      if (matchIndex === 0 || matchIndex === 1) {
        const targetSlot = bracket4TargetSlotForWinner(matchIndex);
        if (targetSlot != null) {
          const [siT, siB] = week2SlotPairIndices(matchIndex);
          const p1 = (finalsBracketSlotsArray[siT] ?? "").trim();
          const p2 = (finalsBracketSlotsArray[siB] ?? "").trim();
          const raw1 = (next[matchIndex * 2] ?? "").trim();
          const raw2 = (next[matchIndex * 2 + 1] ?? "").trim();
          let slotUpdate: string | undefined;
          if (p1 && p2 && !isBye(p1) && !isBye(p2) && raw1 !== "" && raw2 !== "") {
            const n1 = parseInt(raw1, 10);
            const n2 = parseInt(raw2, 10);
            if (!Number.isNaN(n1) && !Number.isNaN(n2)) {
              if (n1 > n2) slotUpdate = p1;
              else if (n2 > n1) slotUpdate = p2;
              else slotUpdate = "";
            }
          }
          if (slotUpdate !== undefined) {
            const nextSlots = [...finalsBracketSlotsArray];
            nextSlots[targetSlot] = slotUpdate;
            patch.finalsBracketSlots = JSON.stringify(nextSlots);
          }
        }
      }

      setDashboardSettings(patch);
    },
    [
      email,
      selectedLeagueName,
      selectedSeason,
      tournamentStarted,
      tournamentPaused,
      finalsBracketScoresArray,
      finalsBracketSlotsArray,
      setDashboardSettings,
    ]
  );

  /** Save one score for one matchup (cardIndex 0–7, matchIndex 0–5, side "top"|"bottom"). */
  const saveScoreChange = useCallback(
    (cardIndex: number, matchIndex: number, side: "top" | "bottom", value: string) => {
      if (!email || cardIndex < 0 || cardIndex > 7 || matchIndex < 0 || matchIndex > 5) return;
      const globalIndex = cardIndex * 6 + matchIndex;
      const key = side === "top" ? `bracketScoreTop${globalIndex}` : `bracketScoreBottom${globalIndex}`;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        [key]: value,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, setDashboardSettings]
  );

  /** Reset selected names in all 8 Week 1 cards (96 bracket slots); does not touch location or other settings. */
  const resetBracketPlayerSlotsOnly = useCallback(() => {
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted,
      tournamentPaused,
      week1BracketsRandomized: false,
      ...Object.fromEntries(
        Array.from({ length: 96 }, (_, i) => [`bracketSlot${i}`, ""])
      ),
    } as Parameters<typeof setDashboardSettings>[0]);
    setBracketResetKey((k) => k + 1);
  }, [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, setDashboardSettings]);

  /** Reset all Week 1, Week 2, and Finals locations plus their start date/time fields. */
  const resetLocationsOnly = useCallback(() => {
    if (!email) return;
    const emptyLocations = Object.fromEntries(
      LOCATION_KEYS.map((key) => [key, ""])
    ) as Record<LocationKey, string>;
    const emptyDates = Object.fromEntries(
      LOCATION_KEYS.map((key) => [key, ""])
    ) as Record<LocationKey, string>;
    const emptyTimes = Object.fromEntries(
      LOCATION_KEYS.map((key) => [key, ""])
    ) as Record<LocationKey, string>;
    setLocations(emptyLocations);
    setLocationStartDates(emptyDates);
    setLocationStartTimes(emptyTimes);
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted,
      tournamentPaused,
      ...emptyLocations,
      locationStartMeta: JSON.stringify(
        Object.fromEntries(
          LOCATION_KEYS.map((key) => [key, { startDate: "", startTime: "" }])
        )
      ),
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [
    email,
    selectedLeagueName,
    selectedSeason,
    tournamentStarted,
    tournamentPaused,
    setDashboardSettings,
  ]);

  const acceptPendingWeek1Randomize = useCallback(() => {
    if (!email || !pendingWeek1RandomizeCards) return;
    const randomizedBracketCards = pendingWeek1RandomizeCards;
    const slotEntries: [string, string][] = [];
    for (let cardIndex = 0; cardIndex < 8; cardIndex++) {
      const base = cardIndex * 12;
      const cardSlots = randomizedBracketCards[cardIndex] ?? Array(12).fill("");
      for (let i = 0; i < 12; i++) {
        slotEntries.push([`bracketSlot${base + i}`, cardSlots[i] ?? ""]);
      }
    }
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted,
      tournamentPaused,
      week1BracketsRandomized: true,
      ...Object.fromEntries(slotEntries),
      ...Object.fromEntries(
        Array.from({ length: 48 }, (_, i) => [`bracketMatchStatus${i}`, ""])
      ),
    } as Parameters<typeof setDashboardSettings>[0]);
    setBracketResetKey(0);
    setPendingWeek1RandomizeCards(null);
  }, [
    email,
    pendingWeek1RandomizeCards,
    selectedLeagueName,
    selectedSeason,
    tournamentStarted,
    tournamentPaused,
    setDashboardSettings,
  ]);

  const randomizeWeek1Brackets = useCallback(() => {
    if (!email) return;
    setIsRandomizingBracket(true);
    window.setTimeout(() => {
      try {
        setRandomizeTooManyAttemptsOpen(false);
        setPendingWeek1RandomizeCards(null);

        const teamByPlayer = new Map(
          playerRows
            .filter((row) => !isBye(row.playerName))
            .map((row) => [row.playerName, row.teamName?.toLowerCase().trim() ?? null] as const)
        );
        const teamDisplayByKey = buildTeamDisplayByKey(playerRows);

        let randomizedBracketCards: string[][] | null = null;
        for (let round = 0; round < MAX_TEAMMATE_LOCATION_RETRY_ROUNDS; round++) {
          let cards = tryRandomizeWeek1Slots(playerRows, PLAYER_SLOTS, true);
          if (cards) {
            randomizedBracketCards = cards;
            break;
          }
          cards = tryRandomizeWeek1Slots(playerRows, PLAYER_SLOTS, false);
          if (!cards) {
            setRandomizeBracketError(
              "Unable to generate a valid Week 1 bracket with the current players while avoiding same-team first-round matchups and limiting byes to one per bracket."
            );
            return;
          }
          const instances = countTeammateSameLocationInstances(
            cards,
            teamByPlayer,
            teamDisplayByKey
          );
          if (instances <= MAX_TEAMMATE_LOCATION_INSTANCES_ALLOWED) {
            randomizedBracketCards = cards;
            break;
          }
        }

        if (!randomizedBracketCards) {
          setRandomizeBracketError(null);
          setRandomizeTooManyAttemptsOpen(true);
          return;
        }

        setRandomizeBracketError(null);

        setPendingWeek1RandomizeCards(randomizedBracketCards);
      } finally {
        setIsRandomizingBracket(false);
      }
    }, 0);
  }, [email, playerRows]);

  const startTournament = useCallback(() => {
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted: true,
      tournamentPaused: false,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, setDashboardSettings]);

  const resetTournament = useCallback(() => {
    if (!email) return;
    const statusReset = Object.fromEntries(
      Array.from({ length: 48 }, (_, i) => [`bracketMatchStatus${i}`, ""])
    );
    const scoreReset = Object.fromEntries([
      ...Array.from({ length: 48 }, (_, i) => [`bracketScoreTop${i}`, "0"]),
      ...Array.from({ length: 48 }, (_, i) => [`bracketScoreBottom${i}`, "0"]),
    ]);
    const emptyGames = JSON.stringify({
      p1: Array.from({ length: 11 }, () => ""),
      p2: Array.from({ length: 11 }, () => ""),
    });
    const liveScoreReset = Object.fromEntries(
      Array.from({ length: 48 }, (_, i) => [`liveScoreGames${i}`, emptyGames])
    );
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted: false,
      tournamentPaused: false,
      week1BracketsRandomized: false,
      week1MatchForfeits: JSON.stringify(Array(WEEK1_MATCH_FORFEIT_COUNT).fill("")),
      week2MatchForfeits: JSON.stringify(Array(WEEK2_MATCH_FORFEIT_COUNT).fill("")),
      finalsMatchForfeits: JSON.stringify(Array(FINALS_MATCH_FORFEIT_COUNT).fill("")),
      ...statusReset,
      ...scoreReset,
      ...liveScoreReset,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, setDashboardSettings]);

  const handleRandomizeButtonClick = useCallback(() => {
    if (week1BracketsRandomized) {
      randomizeWeek1Brackets();
      return;
    }
    setRandomizeBracketModalOpen(true);
  }, [week1BracketsRandomized, randomizeWeek1Brackets]);

  const togglePauseTournament = useCallback(() => {
    if (!email || !tournamentStarted) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentPaused: !tournamentPaused,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, setDashboardSettings]);

  // Debounced save when any location or start date/time input changes (skip until we've applied initial settings from Convex so we don't overwrite with empty state).
  // Do not send tournamentStarted/tournamentPaused here: they are derived from Convex and a pending timer could fire after "Start Tournament" before the query updates, wiping true back to false.
  useEffect(() => {
    if (!email || !settingsQueryHasReturned.current || !hasAppliedInitialSettings.current) return;
    if (!selectedLeagueName || !selectedSeason) return;
    const t = setTimeout(() => {
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        ...locations,
        locationStartMeta: locationStartMetaJson,
      } as Parameters<typeof setDashboardSettings>[0]);
    }, 400);
    return () => clearTimeout(t);
  }, [email, selectedLeagueName, selectedSeason, locations, locationStartMetaJson, setDashboardSettings]);

  const loadPlayers = useCallback((leagueName: string, season: string) => {
    if (!leagueName || !season) {
      setSelectedLeagueGuid(null);
      setPlayersFromApi([]);
      setPlayerRows(
        Array(PLAYER_SLOTS).fill(null).map(() => ({
          playerName: BYE_LABEL,
          weeks: null,
          legacyAve: null,
          raceTo: null,
          teamName: null,
        }))
      );
      return;
    }
    setLoadingPlayers(true);
    const params = new URLSearchParams({
      leagueName: leagueName,
      season: season,
    });
    fetch(`/api/players?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { leagueGuid: string | null; players: PlayerFromApi[] }) => {
        const guid = data.leagueGuid ?? null;
        setPlayersFromApi(Array.isArray(data.players) ? data.players : []);
        setSelectedLeagueGuid(guid);
        if (email && guid) {
          setDashboardSettings({
            email,
            leagueName,
            season,
            leagueGuid: guid,
          } as Parameters<typeof setDashboardSettings>[0]);
        }
        setLoadingPlayers(false);
      })
      .catch(() => {
        setSelectedLeagueGuid(null);
        setPlayersFromApi([]);
        setPlayerRows(
          Array(PLAYER_SLOTS).fill(null).map(() => ({
            playerName: BYE_LABEL,
            weeks: null,
            legacyAve: null,
            raceTo: null,
            teamName: null,
          }))
        );
        setLoadingPlayers(false);
      });
  }, [email, setDashboardSettings]);

  useEffect(() => {
    if (!selectedLeagueName) {
      setSeasonNames([]);
      if (hasAppliedInitialSettings.current) setSelectedSeason("");
      return;
    }
    setLoadingSeasons(true);
    if (!pendingSeasonFromSettings.current) setSelectedSeason("");
    fetch(`/api/seasons?leagueName=${encodeURIComponent(selectedLeagueName)}`)
      .then((r) => r.json())
      .then((data: string[]) => {
        setSeasonNames(Array.isArray(data) ? data : []);
        setLoadingSeasons(false);
      })
      .catch(() => setLoadingSeasons(false));
  }, [selectedLeagueName]);

  useEffect(() => {
    loadPlayers(selectedLeagueName, selectedSeason);
  }, [selectedLeagueName, selectedSeason, loadPlayers]);

  useEffect(() => {
    if (!selectedLeagueGuid) {
      setOverallPlayerStats([]);
      setPlayerRows(
        Array(PLAYER_SLOTS).fill(null).map(() => ({
          playerName: BYE_LABEL,
          weeks: null,
          legacyAve: null,
          raceTo: null,
          teamName: null,
        }))
      );
      return;
    }
    setLoadingOverallStats(true);
    fetch(`/api/overall-player-stats?leagueGuid=${encodeURIComponent(selectedLeagueGuid)}`)
      .then((r) => r.json())
      .then((data: OverallPlayerStatsRow[]) => {
        const stats = Array.isArray(data) ? data : [];
        setOverallPlayerStats(stats);
        const rows: PlayerTableRow[] = stats
          .map((row) => {
            const nameVal = getStatValue(row, "Name", "name", "PlayerName", "Player");
            const name = nameVal != null && nameVal !== "" ? String(nameVal) : BYE_LABEL;
            const weeks = toNumber(getStatValue(row, "Weeks", "weeks", "WeeksPlayed"));
            const legacyAverage = toNumber(
              getStatValue(row, "LegacyAverage", "LegacyAve", "legacyaverage", "legacyave", "Legacy_Average")
            );
            const teamName = playerTeamMap.get(name) ?? null;
            const raceTo =
              legacyAverage != null ? Math.ceil(legacyAverage * 6) : null;
            return {
              playerName: name,
              weeks,
              legacyAve: legacyAverage,
              raceTo,
              teamName,
            };
          })
          .filter((r) => r.weeks != null && r.weeks > 7);
        rows.sort((a, b) =>
          a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" })
        );
        const byeRows: PlayerTableRow[] = Array(
          Math.max(0, PLAYER_SLOTS - rows.length)
        )
          .fill(null)
          .map(() => ({
            playerName: BYE_LABEL,
            weeks: null,
            legacyAve: null,
            raceTo: null,
            teamName: null,
          }));
        setPlayerRows([...rows, ...byeRows].slice(0, PLAYER_SLOTS));
        setLoadingOverallStats(false);
      })
      .catch(() => {
        setOverallPlayerStats([]);
        setPlayerRows(
          Array(PLAYER_SLOTS).fill(null).map(() => ({
            playerName: BYE_LABEL,
            weeks: null,
            legacyAve: null,
            raceTo: null,
            teamName: null,
          }))
        );
        setLoadingOverallStats(false);
      });
  }, [playerTeamMap, selectedLeagueGuid]);

  const sidePanelRef = useRef<HTMLElement>(null);
  const setupScrollRef = useRef<HTMLDivElement>(null);
  const [sidePanelMeasuredWidth, setSidePanelMeasuredWidth] = useState(400);
  const [setupScrollbarPadding, setSetupScrollbarPadding] = useState(0);

  /** Page padding (matches dashboard page: px-4 py-6 md:p-[25px]) and header (h-14) for card positioning. */
  const [pageInsets, setPageInsets] = useState({ left: 16, top: 80, bottom: 24 });
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const update = () => {
      const left = m.matches ? 25 : 16;
      const vertical = m.matches ? 25 : 24;
      setPageInsets({ left, top: 56 + vertical, bottom: vertical });
    };
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!sidePanelRef.current) return;
    const el = sidePanelRef.current;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setSidePanelMeasuredWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!setupScrollRef.current) return;
    const el = setupScrollRef.current;
    const update = () => {
      const hasScrollbar = el.scrollHeight > el.clientHeight;
      setSetupScrollbarPadding(hasScrollbar ? 12 : 0);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      {typeof document !== "undefined" &&
        isRandomizingBracket &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Randomizing Bracket"
          >
            <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" aria-hidden />
            <div className="relative flex flex-col items-center gap-8">
              <div
                className="h-28 w-28 shrink-0 animate-spin rounded-full border-[6px] border-white/15 border-t-blue-400 shadow-lg shadow-blue-950/40"
                aria-hidden
              />
              <p className="text-center text-xl font-semibold tracking-tight text-slate-100">
                Randomizing Bracket…
              </p>
            </div>
          </div>,
          document.body
        )}
      {/* Side card: inset from page padding; always expanded */}
      <aside
        ref={sidePanelRef}
        className="fixed z-30 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl"
        style={{
          left: pageInsets.left,
          top: pageInsets.top,
          bottom: pageInsets.bottom,
          width: "max-content",
          maxWidth: `calc(100vw - ${pageInsets.left * 2}px)`,
        }}
      >
        <div
          ref={setupScrollRef}
          className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-6 overflow-y-auto overflow-x-hidden p-4 pt-4"
          style={setupScrollbarPadding > 0 ? { paddingRight: 16 + setupScrollbarPadding } : undefined}
        >
          <div className="pb-2 pl-[5px]">
            <span className="text-[1.4rem] font-medium text-blue-400">Tournament Setup</span>
          </div>
      {/* Users card – list of Convex users */}
      <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <div
          className="flex min-h-14 w-full flex-shrink-0 items-center rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
          id="users-card-heading"
        >
          <h2 className="text-lg font-semibold tracking-tight text-blue-100">
            Users {usersList != null ? `(${usersList.length})` : ""}
          </h2>
        </div>
          <div
            id="users-card-body"
            aria-labelledby="users-card-heading"
            className="overflow-x-auto rounded-b-xl border-t border-[var(--surface-border)] bg-gradient-to-br from-[#0c1220] via-[#0e1525] to-[#0c1220]"
          >
            {usersList == null ? (
              <p className="p-5 text-sm text-blue-200/70">Loading users…</p>
            ) : usersList.length === 0 ? (
              <p className="p-5 text-sm text-blue-200/70">No users yet.</p>
            ) : (
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-blue-100/90">
                    <th className="whitespace-nowrap px-4 py-2 font-semibold">Name</th>
                    <th className="whitespace-nowrap px-4 py-2 font-semibold">Email</th>
                    <th className="whitespace-nowrap px-4 py-2 font-semibold">PoolHub Player Name</th>
                    <th className="w-20 whitespace-nowrap px-2 py-2 text-right font-semibold" scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr
                      key={u._id}
                      className="border-b border-slate-800 text-foreground hover:bg-white/5"
                    >
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          {canAccessDashboard(u.email) && (
                            <span
                              className="text-yellow-300"
                              title="Has dashboard access"
                              aria-label="Has dashboard access"
                            >
                              ★
                            </span>
                          )}
                          <span>{u.name ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2">{u.email || "—"}</td>
                      <td className="px-4 py-2">{u.poolhubPlayerName ?? "—"}</td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {(u.poolhubPlayerName ?? "").trim() !== "" && (
                            <button
                              type="button"
                              onClick={() =>
                                setUserToUnlink({
                                  email: u.email ?? "",
                                  name: u.name ?? null,
                                  poolhubPlayerName: (u.poolhubPlayerName ?? "").trim(),
                                })
                              }
                              disabled={unlinkingEmail === (u.email ?? "")}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-400 transition-colors hover:bg-amber-500/20 hover:text-amber-300 disabled:opacity-50"
                              title="Unlink PoolHub player from this account"
                              aria-label={`Unlink PoolHub player ${(u.poolhubPlayerName ?? "").trim()} from ${u.email || "user"}`}
                            >
                              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.829 6.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setUserToDelete({
                                _id: u._id,
                                email: u.email ?? "",
                                name: u.name ?? null,
                              })
                            }
                            disabled={deletingUserId === u._id}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                            title="Delete this account"
                            aria-label={`Delete account for ${u.email || "user"}`}
                          >
                            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
      </div>

      <Modal
        open={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        title="Delete user account?"
        hideCloseButton
        closeOnBackdropClick={false}
        footer={
          userToDelete ? (
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingUserId === userToDelete._id}
                onClick={async () => {
                  setDeletingUserId(userToDelete._id);
                  try {
                    await deleteUserMutation({ userId: userToDelete._id });
                    setUserToDelete(null);
                  } catch (e) {
                    console.error("Failed to delete user:", e);
                  } finally {
                    setDeletingUserId(null);
                  }
                }}
                className="rounded-lg border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deletingUserId === userToDelete._id ? "Deleting…" : "Delete account"}
              </button>
            </div>
          ) : undefined
        }
      >
        {userToDelete && (
          <p className="text-slate-200">
            Are you sure you want to permanently delete the account for{" "}
            <strong className="text-white">{userToDelete.name ?? userToDelete.email}</strong>
            {userToDelete.name && (
              <span className="text-slate-300"> ({userToDelete.email})</span>
            )}
            ? This will remove them from the users list. They can sign up again later if needed.
          </p>
        )}
      </Modal>

      <Modal
        open={userToUnlink !== null}
        onClose={() => setUserToUnlink(null)}
        title="Confirm unlink PoolHub player"
        hideCloseButton
        closeOnBackdropClick={false}
        footer={
          userToUnlink ? (
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToUnlink(null)}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlinkingEmail === userToUnlink.email}
                onClick={async () => {
                  setUnlinkingEmail(userToUnlink.email);
                  try {
                    await setPoolhubPlayerNameMutation({
                      email: userToUnlink.email,
                      poolhubPlayerName: "",
                    });
                    setUserToUnlink(null);
                  } catch (e) {
                    console.error("Failed to unlink PoolHub player:", e);
                  } finally {
                    setUnlinkingEmail(null);
                  }
                }}
                className="rounded-lg border border-amber-500/50 bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {unlinkingEmail === userToUnlink.email ? "Unlinking…" : "Confirm unlink"}
              </button>
            </div>
          ) : undefined
        }
      >
        {userToUnlink && (
          <>
            <p className="text-slate-200">
              Remove the PoolHub player link from{" "}
              <strong className="text-white">{userToUnlink.name ?? userToUnlink.email}</strong>
              {userToUnlink.name && (
                <span className="text-slate-300"> ({userToUnlink.email})</span>
              )}
              ? They are currently linked to{" "}
              <strong className="text-amber-200">{userToUnlink.poolhubPlayerName}</strong>
              .
            </p>
            <p className="mt-2 text-sm text-slate-400">
              They can link again later from their profile. This change takes effect only when you confirm below.
            </p>
          </>
        )}
      </Modal>

      {/* League & Season card – content height only; width matches wider card */}
      {leagueLoadError && (
        <div className="w-full min-w-0" role="alert">
          <p id="league-load-error" className="whitespace-pre-line rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {leagueLoadError}
          </p>
        </div>
      )}
      {!loadingLeagues && leagueNames.length === 0 && !leagueLoadError && (
        <div className="w-full min-w-0 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200/90">
          No leagues loaded. Set <code className="rounded bg-white/10 px-1">POOLHUB_DATABASE_URL</code> in your deployment environment and ensure the database is reachable.
        </div>
      )}
      <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] text-foreground">
        <div
          className="flex min-h-14 w-full flex-shrink-0 items-center rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
          id="league-card-heading"
        >
          <h2 className="text-lg font-semibold tracking-tight text-blue-100">Tournament Settings</h2>
        </div>
          <div
            id="league-card-body"
            aria-labelledby="league-card-heading"
            className="flex flex-col gap-4 rounded-b-xl border-t border-[var(--surface-border)] bg-gradient-to-br from-[#0c1220] via-[#0e1525] to-[#0c1220] p-5"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium opacity-90">League Name</span>
              <select
                value={selectedLeagueName}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedLeagueName(v);
                  if (email) setDashboardSettings({ email, leagueName: v, season: "", tournamentStarted, tournamentPaused, week1BracketsRandomized: false } as Parameters<typeof setDashboardSettings>[0]);
                }}
                disabled={loadingLeagues || tournamentStarted || tournamentPaused}
                className="select-dark rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400"
                style={{ borderColor: "var(--surface-border)" }}
                aria-label="League Name"
                aria-describedby={leagueLoadError ? "league-load-error" : undefined}
              >
                <option value="">Select league...</option>
                {leagueNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium opacity-90">Season</span>
              <select
                value={selectedSeason}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedSeason(v);
                  if (email) setDashboardSettings({ email, leagueName: selectedLeagueName, season: v, tournamentStarted, tournamentPaused, week1BracketsRandomized: false } as Parameters<typeof setDashboardSettings>[0]);
                }}
                disabled={!selectedLeagueName || loadingSeasons || tournamentStarted || tournamentPaused}
                className="select-dark rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400"
                style={{ borderColor: "var(--surface-border)" }}
                aria-label="Season"
              >
                <option value="">Select season...</option>
                {seasonNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={startTournament}
                disabled={
                  !allFirstRoundFilled ||
                  tournamentStarted ||
                  tournamentPaused ||
                  !selectedLeagueName?.trim() ||
                  !selectedSeason?.trim() ||
                  !allLocationsFilled
                }
                className="cursor-pointer rounded-lg border border-blue-400/50 bg-gradient-to-r from-blue-800 to-blue-600 px-4 py-2.5 text-sm font-medium text-blue-100 shadow-sm transition-colors hover:from-blue-700 hover:to-blue-500 hover:border-blue-300/60 disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:border-slate-600"
                aria-label="Start Tournament"
                aria-describedby={!tournamentStarted && !tournamentPaused && startTournamentHintMessage ? "start-tournament-hint" : undefined}
              >
                Start Tournament
              </button>
              {!tournamentStarted && !tournamentPaused && startTournamentHintMessage && (
                <p
                  id="start-tournament-hint"
                  className="text-sm text-blue-200/80"
                  role="status"
                  aria-live="polite"
                >
                  {startTournamentHintMessage}
                </p>
              )}
              <button
                type="button"
                onClick={togglePauseTournament}
                disabled={!tournamentStarted}
                className="cursor-pointer rounded-lg border border-green-400/50 bg-gradient-to-r from-green-800 to-green-600 px-4 py-2.5 text-sm font-medium text-green-100 shadow-sm transition-colors hover:from-green-700 hover:to-green-500 hover:border-green-300/60 disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:border-slate-600"
                aria-label={tournamentPaused ? "Resume Tournament" : "Pause Tournament"}
                title={
                  !tournamentStarted
                    ? "Start the tournament first to pause or resume."
                    : undefined
                }
              >
                {tournamentPaused ? "Resume Tournament" : "Pause Tournament"}
              </button>
              <button
                type="button"
                disabled={!tournamentStarted || tournamentPaused}
                className="cursor-pointer rounded-lg border border-slate-400/50 bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-sm transition-colors hover:from-slate-600 hover:to-slate-500 hover:border-slate-300/60 disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:border-slate-600"
                aria-label="End Tournament"
              >
                End Tournament
              </button>
              <button
                type="button"
                onClick={() => setResetTournamentModalOpen(true)}
                disabled={!tournamentStarted || tournamentPaused}
                className="cursor-pointer rounded-lg border border-red-400/50 bg-gradient-to-r from-red-800 to-red-600 px-4 py-2.5 text-sm font-medium text-red-100 shadow-sm transition-colors hover:from-red-700 hover:to-red-500 hover:border-red-300/60 disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:border-slate-600"
                aria-label="Reset Match Scores"
              >
                Reset Match Scores
              </button>
            </div>
            <p className="mt-2 text-[1.3125rem] text-blue-400" aria-live="polite">
              Tournament Status:{" "}
              {tournamentStarted
                ? tournamentPaused
                  ? "Currently Paused"
                  : "Currently Running"
                : "Reset"}
            </p>
            <div className="mt-3">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-blue-100">
                <input
                  type="checkbox"
                  checked={showBracketsOnHomeScreen}
                  onChange={(e) => {
                    if (!email) return;
                    setDashboardSettings({
                      email,
                      leagueName: selectedLeagueName,
                      season: selectedSeason,
                      tournamentStarted,
                      tournamentPaused,
                      showBracketsOnHomeScreen: e.target.checked,
                    } as Parameters<typeof setDashboardSettings>[0]);
                  }}
                  className="h-4 w-4 rounded border-white/30 bg-slate-900 text-blue-500 focus:ring-2 focus:ring-blue-400"
                  aria-label="Show Brackets on Home Screen"
                />
                <span>Show Brackets on Home Screen</span>
              </label>
              <p
                className="mt-1.5 pl-7 text-xs text-slate-400 dark:text-slate-500"
                aria-live="polite"
              >
                Teammates at same Week 1 location:{" "}
                <span className="font-medium tabular-nums text-slate-300 dark:text-slate-400">
                  {week1TeammateLocationOverlapCount}
                </span>
              </p>
            </div>
            {!tournamentStarted && !tournamentPaused && (
              <button
                type="button"
                onClick={handleRandomizeButtonClick}
                className="mt-2 cursor-pointer rounded-lg border border-purple-400/50 bg-purple-800/60 px-3 py-2 text-sm font-medium text-purple-100 shadow-sm transition-colors hover:bg-purple-700/70"
                aria-label="Randomize Bracket"
              >
                Randomize Bracket
              </button>
            )}
            {!tournamentStarted && !tournamentPaused && anyFirstRoundFilled && (
              <button
                type="button"
                onClick={() => setResetBracketsModalOpen(true)}
                className="mt-2 cursor-pointer rounded-lg border border-blue-400/50 bg-blue-800/60 px-3 py-2 text-sm font-medium text-blue-100 shadow-sm transition-colors hover:bg-blue-700/70"
                aria-label="Reset Brackets"
              >
                Reset Brackets
              </button>
            )}
            {!tournamentStarted && !tournamentPaused && anyWeek1LocationsFilled && (
              <button
                type="button"
                onClick={() => setResetLocationsModalOpen(true)}
                className="mt-2 cursor-pointer rounded-lg border border-amber-400/50 bg-amber-800/60 px-3 py-2 text-sm font-medium text-amber-100 shadow-sm transition-colors hover:bg-amber-700/70"
                aria-label="Reset Locations"
              >
                Reset Locations
              </button>
            )}
            <Modal
              open={randomizeBracketModalOpen}
              onClose={() => setRandomizeBracketModalOpen(false)}
              title="Randomize Bracket"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRandomizeBracketModalOpen(false)}
                    className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      randomizeWeek1Brackets();
                      setRandomizeBracketModalOpen(false);
                    }}
                    className="cursor-pointer rounded-lg border border-purple-400/50 bg-purple-800/80 px-4 py-2.5 text-sm font-medium text-purple-100 shadow-sm transition-colors hover:bg-purple-700/80"
                    aria-label="Confirm randomize bracket"
                  >
                    Randomize Bracket
                  </button>
                </div>
              }
            >
              <p className="text-slate-200">
                Randomly fill all Week 1 first-round brackets using the current player list? This will allow at most one bye per bracket, prevent bye-vs-bye matchups, avoid first-round matchups between players on the same team, and try to keep teammates at different Week 1 locations when possible. You will preview the draw and choose Accept to save it.
              </p>
            </Modal>
            <Modal
              open={pendingWeek1RandomizeCards != null}
              onClose={() => setPendingWeek1RandomizeCards(null)}
              title="Week 1 draw complete"
              titleDescription={
                pendingWeek1RandomizeModalPayload ? (
                  <span className="block text-[1.75rem] leading-snug text-slate-400">
                    Teammates at same Week 1 location:{" "}
                    <span className="font-medium tabular-nums text-slate-200">
                      {pendingWeek1RandomizeModalPayload.teammateConflicts.length}
                    </span>
                  </span>
                ) : undefined
              }
              panelClassName="max-w-2xl"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingWeek1RandomizeCards(null)}
                    className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={acceptPendingWeek1Randomize}
                    className="cursor-pointer rounded-lg border border-green-500/50 bg-green-700/90 px-4 py-2.5 text-sm font-semibold text-green-50 shadow-sm transition-colors hover:bg-green-600/90"
                    aria-label="Accept draw and save to brackets"
                  >
                    Accept
                  </button>
                </div>
              }
            >
              {pendingWeek1RandomizeModalPayload && (
                <div className="max-h-[min(70vh,36rem)] space-y-5 overflow-y-auto pr-1 text-slate-200">
                  <p className="text-sm leading-relaxed text-slate-400">
                    Review this draw. Accept saves it to Week 1 brackets; Cancel keeps your current
                    brackets.
                  </p>
                  {pendingWeek1RandomizeModalPayload.teammateConflicts.length > 0 && (
                    <div
                      className="rounded-lg border border-amber-500/30 bg-amber-950/25 p-4 text-sm"
                      role="region"
                      aria-label="Teammates at same location"
                    >
                      <p className="mb-3 font-medium text-amber-200">
                        Teammates at the same Week 1 location (
                        {pendingWeek1RandomizeModalPayload.teammateConflicts.length}{" "}
                        {pendingWeek1RandomizeModalPayload.teammateConflicts.length === 1
                          ? "case"
                          : "cases"}
                        )
                      </p>
                      <ul className="space-y-2" role="list">
                        {pendingWeek1RandomizeModalPayload.teammateConflicts.map((c, idx) => (
                          <li
                            key={`${c.locationLabel}-${c.teamLabel}-${idx}`}
                            className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2"
                          >
                            <span className="font-medium text-amber-100/95">{c.locationLabel}</span>
                            <span className="text-slate-400"> — </span>
                            <span className="text-slate-100">{c.teamLabel}</span>
                            <span className="mt-1 block text-slate-300">
                              {c.players.map((p) => formatDrawModalPlayerWithTeam(p, playerRows)).join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm font-medium text-slate-300">First-round matchups by location</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {pendingWeek1RandomizeModalPayload.locations.map((loc) => (
                      <div
                        key={loc.locationLabel}
                        className="min-w-0 rounded-lg border border-white/10 bg-slate-900/35 p-3"
                      >
                        <h3 className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold text-blue-300">
                          {loc.locationLabel}
                        </h3>
                        <ul className="space-y-3 text-sm" role="list">
                          {loc.matchups.map((m, mi) => (
                            <li
                              key={`${loc.locationLabel}-m${mi}`}
                              className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2.5 shadow-sm"
                            >
                              <div
                                className="min-w-0 truncate text-center text-[0.8125rem] font-semibold leading-tight text-slate-100"
                                title={m.top}
                              >
                                {m.top}
                              </div>
                              <div className="py-1.5 text-center" aria-hidden>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-400">
                                  vs
                                </span>
                              </div>
                              <div
                                className="min-w-0 truncate text-center text-[0.8125rem] font-semibold leading-tight text-slate-100"
                                title={m.bottom}
                              >
                                {m.bottom}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Modal>
            <Modal
              open={randomizeTooManyAttemptsOpen}
              onClose={() => setRandomizeTooManyAttemptsOpen(false)}
              title="Could not meet location spread"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRandomizeTooManyAttemptsOpen(false)}
                    className="cursor-pointer rounded-lg border border-amber-400/50 bg-amber-800/80 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-sm transition-colors hover:bg-amber-700/80"
                  >
                    Close
                  </button>
                </div>
              }
            >
              <div className="space-y-3 text-sm leading-relaxed text-slate-200">
                <p>
                  After {MAX_TEAMMATE_LOCATION_RETRY_ROUNDS} random draws, the bracket still had
                  more than {MAX_TEAMMATE_LOCATION_INSTANCES_ALLOWED} cases of teammates assigned to
                  the same Week 1 location (counting each team at each location as one case).
                </p>
                <p className="text-slate-300">
                  No changes were saved. Try again, adjust the player list or teams, or fill brackets
                  manually.
                </p>
              </div>
            </Modal>
            <Modal
              open={resetTournamentModalOpen}
              onClose={() => setResetTournamentModalOpen(false)}
              title="Reset Match Scores?"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setResetTournamentModalOpen(false)}
                    className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetTournament();
                      setResetTournamentModalOpen(false);
                    }}
                    className="cursor-pointer rounded-lg border border-red-400/50 bg-red-800/80 px-4 py-2.5 text-sm font-medium text-red-100 shadow-sm transition-colors hover:bg-red-700/80"
                    aria-label="Confirm reset match scores"
                  >
                    Reset Match Scores
                  </button>
                </div>
              }
            >
              <p className="text-slate-200">
                All match scores will be cleared. The bracket and player assignments will stay the same. This cannot be undone.
              </p>
            </Modal>
            <Modal
              open={resetBracketsModalOpen}
              onClose={() => setResetBracketsModalOpen(false)}
              title="Reset Brackets"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setResetBracketsModalOpen(false)}
                    className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetBracketPlayerSlotsOnly();
                      setResetBracketsModalOpen(false);
                    }}
                    className="cursor-pointer rounded-lg border border-red-400/50 bg-red-800/80 px-4 py-2.5 text-sm font-medium text-red-100 shadow-sm transition-colors hover:bg-red-700/80"
                    aria-label="Confirm reset brackets"
                  >
                    Reset Brackets
                  </button>
                </div>
              }
            >
              <p className="text-slate-200">
                Clear all player selections from every bracket slot (all 8 Week 1 cards)? Location and other tournament settings will not be changed.
              </p>
            </Modal>
            <Modal
              open={resetLocationsModalOpen}
              onClose={() => setResetLocationsModalOpen(false)}
              title="Reset Locations"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setResetLocationsModalOpen(false)}
                    className="cursor-pointer rounded-lg border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetLocationsOnly();
                      setResetLocationsModalOpen(false);
                    }}
                    className="cursor-pointer rounded-lg border border-amber-400/50 bg-amber-800/80 px-4 py-2.5 text-sm font-medium text-amber-100 shadow-sm transition-colors hover:bg-amber-700/80"
                    aria-label="Confirm reset locations"
                  >
                    Reset Locations
                  </button>
                </div>
              }
            >
              <p className="text-slate-200">
                Clear all Week 1, Week 2, and Finals locations plus their start date and start time fields? Brackets and scores will not be changed.
              </p>
            </Modal>
            <hr className="border-t border-[var(--surface-border)] my-4" aria-hidden />
            {randomizeBracketError && (
              <p className="rounded-lg border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200" role="alert">
                {randomizeBracketError}
              </p>
            )}
            {venueSyncError && (
              <p className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200" role="alert">
                {venueSyncError}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <h3
                  id="league-card-week1-locations-heading"
                  className="text-center text-xl font-semibold text-yellow-400"
                >
                  Week 1
                </h3>
                <div
                  id="league-card-week1-locations"
                  aria-labelledby="league-card-week1-locations-heading"
                  className="flex flex-col gap-3 px-[5px] pb-[5px]"
                >
                  {WEEK_1_KEYS.map((key) => (
                    <div
                      key={key}
                      className="rounded-lg border border-[var(--surface-border)] bg-slate-800/30 p-3"
                    >
                      <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
                        <span className="text-sm font-medium text-blue-400">{LOCATION_LABELS[key]}</span>
                        <select
                          value={locations[key]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocations((prev) => ({ ...prev, [key]: v }));
                        }}
                        onBlur={saveLocations}
                        disabled={venuesLoading || lockLocationScheduleFields}
                        className={`select-dark min-w-0 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400 ${locations[key]?.trim() ? "slot-filled" : ""}`}
                        style={{ borderColor: "var(--surface-border)" }}
                        aria-label={LOCATION_LABELS[key]}
                      >
                        <option value="">Select venue...</option>
                        {(() => {
                          const options = venueOptionsFor(key, locations, venueNames);
                          const list = options.length > 0 ? options : venueNames;
                          return list.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ));
                        })()}
                      </select>
                        <span className="text-sm font-medium text-blue-400">Start Date</span>
                        <input
                          type="date"
                          value={locationStartDates[key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLocationStartDates((prev) => ({ ...prev, [key]: v }));
                            const meta = Object.fromEntries(
                              LOCATION_KEYS.map((k) => [
                                k,
                                {
                                  startDate: k === key ? v : locationStartDates[k] ?? "",
                                  startTime: locationStartTimes[k] ?? "",
                                },
                              ])
                            );
                            saveLocationStartMeta(JSON.stringify(meta));
                          }}
                          onBlur={saveLocations}
                          disabled={lockLocationScheduleFields}
                          className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                          style={{ borderColor: "var(--surface-border)" }}
                          aria-label={`${LOCATION_LABELS[key]} start date`}
                        />
                        <span className="text-sm font-medium text-blue-400">Start Time</span>
                        <input
                          type="time"
                          value={locationStartTimes[key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLocationStartTimes((prev) => ({ ...prev, [key]: v }));
                            const meta = Object.fromEntries(
                              LOCATION_KEYS.map((k) => [
                                k,
                                {
                                  startDate: locationStartDates[k] ?? "",
                                  startTime: k === key ? v : locationStartTimes[k] ?? "",
                                },
                              ])
                            );
                            saveLocationStartMeta(JSON.stringify(meta));
                          }}
                          onBlur={saveLocations}
                          disabled={lockLocationScheduleFields}
                          className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                          style={{ borderColor: "var(--surface-border)" }}
                          aria-label={`${LOCATION_LABELS[key]} start time`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <hr className="border-t border-[var(--surface-border)] my-1" aria-hidden />
              <div className="flex flex-col gap-2">
                <h3
                  id="league-card-week2-locations-heading"
                  className="text-center text-xl font-semibold text-yellow-400"
                >
                  Week 2
                </h3>
                <div
                  id="league-card-week2-locations"
                  aria-labelledby="league-card-week2-locations-heading"
                  className="flex flex-col gap-3 px-[5px] pb-4"
                >
                  {WEEK_2_KEYS.map((key) => (
                    <div
                      key={key}
                      className="rounded-lg border border-[var(--surface-border)] bg-slate-800/30 p-3"
                    >
                      <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
                        <span className="text-sm font-medium text-blue-400">{LOCATION_LABELS[key]}</span>
                        <select
                          value={locations[key]}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocations((prev) => ({ ...prev, [key]: v }));
                        }}
                        onBlur={saveLocations}
                        disabled={venuesLoading || lockLocationScheduleFields}
                        className={`select-dark min-w-0 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400 ${locations[key]?.trim() ? "slot-filled" : ""}`}
                        style={{ borderColor: "var(--surface-border)" }}
                        aria-label={LOCATION_LABELS[key]}
                      >
                        <option value="">Select venue...</option>
                        {(() => {
                          const options = venueOptionsFor(key, locations, venueNames);
                          const list = options.length > 0 ? options : venueNames;
                          return list.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ));
                        })()}
                      </select>
                        <span className="text-sm font-medium text-blue-400">Start Date</span>
                        <input
                          type="date"
                          value={locationStartDates[key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLocationStartDates((prev) => ({ ...prev, [key]: v }));
                            const meta = Object.fromEntries(
                              LOCATION_KEYS.map((k) => [
                                k,
                                {
                                  startDate: k === key ? v : locationStartDates[k] ?? "",
                                  startTime: locationStartTimes[k] ?? "",
                                },
                              ])
                            );
                            saveLocationStartMeta(JSON.stringify(meta));
                          }}
                          onBlur={saveLocations}
                          disabled={lockLocationScheduleFields}
                          className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                          style={{ borderColor: "var(--surface-border)" }}
                          aria-label={`${LOCATION_LABELS[key]} start date`}
                        />
                        <span className="text-sm font-medium text-blue-400">Start Time</span>
                        <input
                          type="time"
                          value={locationStartTimes[key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLocationStartTimes((prev) => ({ ...prev, [key]: v }));
                            const meta = Object.fromEntries(
                              LOCATION_KEYS.map((k) => [
                                k,
                                {
                                  startDate: locationStartDates[k] ?? "",
                                  startTime: k === key ? v : locationStartTimes[k] ?? "",
                                },
                              ])
                            );
                            saveLocationStartMeta(JSON.stringify(meta));
                          }}
                          onBlur={saveLocations}
                          disabled={lockLocationScheduleFields}
                          className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                          style={{ borderColor: "var(--surface-border)" }}
                          aria-label={`${LOCATION_LABELS[key]} start time`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <hr className="border-t border-[var(--surface-border)] my-1" aria-hidden />
              <div className="flex flex-col gap-2">
                <h3
                  id="league-card-finals-location-heading"
                  className="text-center text-xl font-semibold text-yellow-400"
                >
                  Finals
                </h3>
                <div
                  id="league-card-finals-location"
                  aria-labelledby="league-card-finals-location-heading"
                  className="flex flex-col gap-3 px-[5px] pb-[5px]"
                >
                  <div className="rounded-lg border border-[var(--surface-border)] bg-slate-800/30 p-3">
                    <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
                      <span className="text-sm font-medium text-blue-400">{LOCATION_LABELS.finalsLocation}</span>
                      <select
                      value={locations.finalsLocation}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocations((prev) => ({ ...prev, finalsLocation: v }));
                      }}
                      onBlur={saveLocations}
                      disabled={venuesLoading || lockLocationScheduleFields}
                      className={`select-dark min-w-0 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-800/70 disabled:text-slate-400 ${locations.finalsLocation?.trim() ? "slot-filled" : ""}`}
                      style={{ borderColor: "var(--surface-border)" }}
                      aria-label={LOCATION_LABELS.finalsLocation}
                    >
                      <option value="">Select venue...</option>
                      {(() => {
                        const options = venueOptionsFor("finalsLocation", locations, venueNames);
                        const list = options.length > 0 ? options : venueNames;
                        return list.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ));
                      })()}
                    </select>
                      <span className="text-sm font-medium text-blue-400">Start Date</span>
                      <input
                        type="date"
                        value={locationStartDates.finalsLocation ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocationStartDates((prev) => ({ ...prev, finalsLocation: v }));
                          const meta = Object.fromEntries(
                            LOCATION_KEYS.map((k) => [
                              k,
                              {
                                startDate: k === "finalsLocation" ? v : locationStartDates[k] ?? "",
                                startTime: locationStartTimes[k] ?? "",
                              },
                            ])
                          );
                          saveLocationStartMeta(JSON.stringify(meta));
                        }}
                        onBlur={saveLocations}
                        disabled={lockLocationScheduleFields}
                        className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                        style={{ borderColor: "var(--surface-border)" }}
                        aria-label="Finals start date"
                      />
                      <span className="text-sm font-medium text-blue-400">Start Time</span>
                      <input
                        type="time"
                        value={locationStartTimes.finalsLocation ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocationStartTimes((prev) => ({ ...prev, finalsLocation: v }));
                          const meta = Object.fromEntries(
                            LOCATION_KEYS.map((k) => [
                              k,
                              {
                                startDate: locationStartDates[k] ?? "",
                                startTime: k === "finalsLocation" ? v : locationStartTimes[k] ?? "",
                              },
                            ])
                          );
                          saveLocationStartMeta(JSON.stringify(meta));
                        }}
                        onBlur={saveLocations}
                        disabled={lockLocationScheduleFields}
                        className="input-dark min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:bg-slate-800/70 disabled:text-slate-400"
                        style={{ borderColor: "var(--surface-border)" }}
                        aria-label="Finals start time"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Players card – below League card; same width as League card */}
      <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <div
          className="flex min-h-14 w-full flex-shrink-0 items-center rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
          id="players-card-heading"
        >
          <h2 className="text-lg font-semibold tracking-tight text-blue-100">
            Players ({playerRows.filter((r) => r.playerName !== BYE_LABEL).length})
          </h2>
        </div>
        <div
          id="players-card-body"
          aria-labelledby="players-card-heading"
          className="max-h-none"
        >
          <div className="overflow-x-auto bg-gradient-to-br from-[#0c1220] via-[#0e1525] to-[#0c1220]">
            <table className="w-max min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-blue-100/90">
                  <th className="whitespace-nowrap px-4 py-2 font-semibold">#</th>
                  <th className="whitespace-nowrap px-4 py-2 font-semibold">Player Name</th>
                  <th className="whitespace-nowrap px-4 py-2 font-semibold">Weeks</th>
                  <th className="whitespace-nowrap px-4 py-2 font-semibold">Legacy Ave</th>
                  <th className="whitespace-nowrap px-4 py-2 font-semibold">Race To</th>
                </tr>
              </thead>
              <tbody>
                {playerRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-900/70 last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-blue-200/80">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">{playerDisplayNames[i]}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {row.weeks != null ? row.weeks : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {row.legacyAve != null ? row.legacyAve : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {row.raceTo != null ? row.raceTo : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </div>
      </aside>

      {/* Main content: bracket columns, with margin so they don’t sit under the setup panel */}
      <div
        className="min-w-0 w-full overflow-x-hidden transition-[padding] duration-200 ease-out"
        style={{
          paddingLeft: pageInsets.left + sidePanelMeasuredWidth,
        }}
      >
        <div className="min-w-0 overflow-x-auto pb-10">
          <div className="flex min-w-max flex-wrap gap-6 items-start">
      {/* Column 2: Week 1 location slot cards (8 cards) – all cards match width of widest (expanded) card */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
          Week 1
        </h2>
        {WEEK_1_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground"
          >
            <div
              className="flex min-h-14 w-full flex-shrink-0 flex-col gap-1 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
              id={`week1-slot-${index}-heading`}
            >
              <div className="w-full">
                <h2 className="min-w-0 truncate text-center text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                  {locations[key]?.trim() || "TBD"}
                </h2>
              </div>
              <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-2 text-sm font-medium text-blue-100/90">
                <span className="text-left">Week 1</span>
                <span className="text-center">
                  {formatLocationDate(locationStartDates[key] ?? "") || "—"}
                </span>
                <span className="text-right">
                  {formatLocationTime(locationStartTimes[key] ?? "") || "—"}
                </span>
              </div>
            </div>
              <div
                id={`week1-slot-${index}-body`}
                aria-labelledby={`week1-slot-${index}-heading`}
                className="w-fit overflow-visible rounded-b-xl border-t border-white/40 bg-black pb-2 pt-2 pl-4"
              >
                <Bracket8TwoRounds
                  key={`${bracketResetKey}-${index}`}
                  players={playerDisplayNames}
                  playerRaceToMap={Object.fromEntries(
                    playerRows.map((r) => [r.playerName, r.raceTo])
                  )}
                  initialSlotSelections={
                    bracketResetKey > 0
                      ? Array(12).fill("")
                      : savedSettings
                        ? (() => {
                            let byeNum = 0;
                            const base = index * 12;
                            return Array.from({ length: 12 }, (_, i) => {
                              const slotKey = `bracketSlot${base + i}`;
                              const v = (savedSettings as Record<string, unknown>)[slotKey];
                              const val = typeof v === "string" ? v : "";
                              if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                              return val;
                            });
                          })()
                        : undefined
                  }
                  onBracketSlotsChange={(slots) => saveBracketSlots(index, slots)}
                  initialScores={
                    savedSettings
                      ? Array.from({ length: 12 }, (_, i) => {
                          const topOrBottom = i % 2 === 0 ? "Top" : "Bottom";
                          const matchIndex = Math.floor(i / 2);
                          const globalIndex = index * 6 + matchIndex;
                          const key = `bracketScore${topOrBottom}${globalIndex}`;
                          const v = (savedSettings as Record<string, unknown>)[key];
                          return typeof v === "string" ? v : "0";
                        })
                      : undefined
                  }
                  onScoreChange={(matchIndex, side, value) => saveScoreChange(index, matchIndex, side, value)}
                  cardIndex={index}
                  allFirstRoundSelections={allFirstRoundSelections}
                  disabled={false}
                  matchStatusByIndex={getMatchStatusByIndex(index)}
                  onMatchNameContextMenu={(matchIndex) =>
                    onWeek1MatchNameContextMenu(index, matchIndex)
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

      {/* Column 3: Week 2 location slot cards (4 cards, 4-person brackets like Finals) */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
          Week 2
        </h2>
        {WEEK_2_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground"
          >
            <div
              className="flex min-h-14 w-full flex-shrink-0 flex-col gap-1 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
              id={`week2-slot-${index}-heading`}
            >
              <div className="w-full">
                <h2 className="min-w-0 truncate text-center text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                  {locations[key]?.trim() || "TBD"}
                </h2>
              </div>
              <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-2 text-sm font-medium text-blue-100/90">
                <span className="text-left">Week 2</span>
                <span className="text-center">
                  {formatLocationDate(locationStartDates[key] ?? "") || "—"}
                </span>
                <span className="text-right">
                  {formatLocationTime(locationStartTimes[key] ?? "") || "—"}
                </span>
              </div>
            </div>
              <div
                id={`week2-slot-${index}-body`}
                aria-labelledby={`week2-slot-${index}-heading`}
                className="w-fit overflow-visible rounded-b-xl border-t border-white/40 bg-black pb-2 pt-2 pl-4"
              >
                <Bracket4
                  key={`week2-bracket-${index}-${selectedLeagueName}-${selectedSeason}`}
                  players={playerDisplayNames}
                  playerRaceToMap={Object.fromEntries(
                    playerRows.map((r) => [r.playerName, r.raceTo])
                  )}
                  initialSlotSelections={(() => {
                    const base = index * 6;
                    let byeNum = 0;
                    return Array.from({ length: 6 }, (_, i) => {
                      const val = week2BracketSlotsArray[base + i] ?? "";
                      if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                      return val;
                    });
                  })()}
                  onBracketSlotsChange={(slots) => saveWeek2BracketSlots(index, slots)}
                  initialScores={week2BracketScoresArray.slice(index * 6, index * 6 + 6)}
                  onScoreChange={(matchIndex, side, value) =>
                    saveWeek2ScoreChange(index, matchIndex, side, value)
                  }
                  disabled={false}
                  matchStatusByIndex={getWeek2MatchStatusByIndex(index)}
                  onMatchNameContextMenu={(matchIndex) =>
                    onWeek2MatchNameContextMenu(index, matchIndex)
                  }
                  matchForfeitingPlayerByMatchIndex={week2MatchForfeitsArray.slice(
                    index * 3,
                    index * 3 + 3
                  )}
                />
              </div>
          </div>
        ))}
      </div>

      {/* Column 4: Finals (1 card, 4-person bracket) – same structure and styling as Week 2 cards */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        <h2 className="w-full shrink-0 text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
          Finals
        </h2>
        <div className="w-max min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground">
          <div
            className="flex min-h-14 w-full flex-shrink-0 flex-col gap-1 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
            id="finals-slot-heading"
          >
            <div className="w-full">
              <h2 className="min-w-0 truncate text-center text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                {locations.finalsLocation?.trim() || "TBD"}
              </h2>
            </div>
            <div className="grid w-full grid-cols-3 items-center gap-2 border-t border-white/30 pt-2 text-sm font-medium text-blue-100/90">
              <span className="text-left">Finals</span>
              <span className="text-center">
                {formatLocationDate(locationStartDates.finalsLocation ?? "") || "—"}
              </span>
              <span className="text-right">
                {formatLocationTime(locationStartTimes.finalsLocation ?? "") || "—"}
              </span>
            </div>
          </div>
            <div
              id="finals-slot-body"
              aria-labelledby="finals-slot-heading"
              className="w-fit overflow-visible rounded-b-xl border-t border-white/40 bg-black pb-2 pt-2 pl-4"
            >
              <Bracket4
                key={`finals-bracket-${selectedLeagueName}-${selectedSeason}`}
                players={playerDisplayNames}
                playerRaceToMap={Object.fromEntries(
                  playerRows.map((r) => [r.playerName, r.raceTo])
                )}
                initialSlotSelections={(() => {
                  let byeNum = 0;
                  return finalsBracketSlotsArray.map((val) => {
                    if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                    return val;
                  });
                })()}
                onBracketSlotsChange={saveFinalsBracketSlots}
                initialScores={finalsBracketScoresArray}
                onScoreChange={saveFinalsScoreChange}
                disabled={false}
                matchStatusByIndex={getFinalsMatchStatusByIndex()}
                onMatchNameContextMenu={onFinalsMatchNameContextMenu}
                matchForfeitingPlayerByMatchIndex={finalsMatchForfeitsArray}
              />
              {finalsChampion != null && (
                <>
                  <div className="mt-4 border-t border-white/40 pt-4">
                    <p className="text-center text-lg font-semibold text-yellow-400">
                      Champion!!!
                    </p>
                    <p className="mt-1 text-center text-base font-medium text-blue-400">
                      {finalsChampion}
                    </p>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>
        </div>
        </div>
      </div>
    </>
  );
}
