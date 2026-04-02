"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { canAccessDashboard } from "@/lib/dashboard-access";

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

/** Venue names available for this dropdown: exclude venues selected in other dropdowns in the same week. */
function venueOptionsFor(
  key: LocationKey,
  locations: Record<LocationKey, string>,
  venueNames: string[]
): string[] {
  if (venueNames.length === 0) return [];
  const sameWeekKeys =
    WEEK_1_KEYS.includes(key) ? WEEK_1_KEYS
    : WEEK_2_KEYS.includes(key) ? WEEK_2_KEYS
    : [];
  const currentValue = locations[key] ?? "";
  return venueNames.filter(
    (name) =>
      name === currentValue ||
      !sameWeekKeys.some((k) => k !== key && (locations[k] ?? "") === name)
  );
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
  const savedSettings = useQuery(api.dashboardSettings.getShared, {});
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
  const [leagueCardOpen, setLeagueCardOpen] = useState(false);
  const [playersCardOpen, setPlayersCardOpen] = useState(false);
  const [usersCardOpen, setUsersCardOpen] = useState(false);
  const [week1SlotCardsOpen, setWeek1SlotCardsOpen] = useState<boolean[]>(
    () => Array(8).fill(false)
  );
  const [week2SlotCardsOpen, setWeek2SlotCardsOpen] = useState<boolean[]>(
    () => Array(4).fill(false)
  );
  const [finalsCardOpen, setFinalsCardOpen] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [week1SectionOpen, setWeek1SectionOpen] = useState(false);
  const [week2SectionOpen, setWeek2SectionOpen] = useState(false);
  const [finalsSectionOpen, setFinalsSectionOpen] = useState(false);
  const [bracketResetKey, setBracketResetKey] = useState(0);
  const [resetBracketsModalOpen, setResetBracketsModalOpen] = useState(false);
  const [resetLocationsModalOpen, setResetLocationsModalOpen] = useState(false);
  const [randomizeBracketModalOpen, setRandomizeBracketModalOpen] = useState(false);
  const [resetTournamentModalOpen, setResetTournamentModalOpen] = useState(false);
  const [randomizeBracketError, setRandomizeBracketError] = useState<string | null>(null);
  const [randomizeTooManyAttemptsOpen, setRandomizeTooManyAttemptsOpen] = useState(false);
  const [randomizeSuccessModal, setRandomizeSuccessModal] =
    useState<RandomizeWeek1SuccessModalPayload | null>(null);
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

  /** First-round slot values for all 8 Week 1 cards (8×8=64). Used so each first-round dropdown excludes names selected in any other card’s first round. */
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

  /** Week 2 bracket slots: 4 cards × 12 slots = 48. Parsed from savedSettings.week2BracketSlots JSON. */
  const week2BracketSlotsArray = useMemo(() => {
    const raw = savedSettings && typeof savedSettings === "object"
      ? (savedSettings as Record<string, unknown>).week2BracketSlots
      : undefined;
    if (typeof raw !== "string" || !raw.trim()) return Array(48).fill("") as string[];
    try {
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr) || arr.length !== 48) return Array(48).fill("") as string[];
      return arr.map((v) => (typeof v === "string" ? v : ""));
    } catch {
      return Array(48).fill("") as string[];
    }
  }, [savedSettings]);

  /** First-round slot values for all 4 Week 2 cards (4×8=32). For dropdown exclusions. */
  const allFirstRoundSelectionsWeek2 = useMemo(() => {
    const out: string[] = [];
    for (let c = 0; c < 4; c++) {
      for (let i = 0; i < 8; i++) {
        out.push(week2BracketSlotsArray[c * 12 + i] ?? "");
      }
    }
    return out;
  }, [week2BracketSlotsArray]);

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
        const val = (s[`bracketMatchStatus${cardIndex * 6 + i}`] as string) ?? "";
        return val.trim() || null;
      });
    },
    [savedSettings]
  );

  const getWeek2MatchStatusByIndex = useCallback(
    (cardIndex: number): (string | null)[] => {
      if (!savedSettings || typeof savedSettings !== "object") return Array(6).fill(null);
      const s = savedSettings as Record<string, unknown>;
      const base = 48 + cardIndex * 6;
      return Array.from({ length: 6 }, (_, i) => {
        const val = (s[`bracketMatchStatus${base + i}`] as string) ?? "";
        return val.trim() || null;
      });
    },
    [savedSettings]
  );

  const getFinalsMatchStatusByIndex = useCallback((): (string | null)[] => {
    if (!savedSettings || typeof savedSettings !== "object") return Array(3).fill(null);
    const s = savedSettings as Record<string, unknown>;
    const base = 72;
    return Array.from({ length: 3 }, (_, i) => {
      const val = (s[`bracketMatchStatus${base + i}`] as string) ?? "";
      return val.trim() || null;
    });
  }, [savedSettings]);

  const tournamentStarted =
    (savedSettings && typeof savedSettings === "object" && (savedSettings as Record<string, unknown>).tournamentStarted === true) ?? false;
  const tournamentPaused =
    (savedSettings && typeof savedSettings === "object" && (savedSettings as Record<string, unknown>).tournamentPaused === true) ?? false;
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
    const ui = rest as Record<string, unknown>;
    if (ui.uiUsersCardOpen === true) setUsersCardOpen(true);
    if (ui.uiLeagueCardOpen === true) setLeagueCardOpen(true);
    if (ui.uiPlayersCardOpen === true) setPlayersCardOpen(true);
    if (ui.uiWeek1SectionOpen === true) setWeek1SectionOpen(true);
    if (ui.uiWeek2SectionOpen === true) setWeek2SectionOpen(true);
    if (ui.uiFinalsSectionOpen === true) setFinalsSectionOpen(true);
    setWeek1SlotCardsOpen((prev) =>
      prev.map((_, i) => (ui[`uiWeek1Slot${i}Open`] === true) || prev[i])
    );
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
        tournamentStarted,
        tournamentPaused,
        ...locations,
        locationStartMeta: metaJson,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, locations, setDashboardSettings]
  );

  const saveLocations = useCallback(() => {
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted,
      tournamentPaused,
      ...locations,
      locationStartMeta: locationStartMetaJson,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, locations, locationStartMetaJson, setDashboardSettings]);

  /** Slot indices for a matchup: matchIndex 0->0,1; 1->2,3; ...; 5->10,11. */
  const slotIndicesForMatch = useCallback((matchIndex: number): [number, number] => {
    const top = matchIndex < 4 ? matchIndex * 2 : 8 + (matchIndex - 4) * 2;
    return [top, top + 1];
  }, []);

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

  /** Save the 12 bracket slots for one Week 2 card (cardIndex 0–3). Persists to week2BracketSlots JSON. */
  const saveWeek2BracketSlots = useCallback(
    (cardIndex: number, slots: string[]) => {
      if (!email || slots.length !== 12 || cardIndex < 0 || cardIndex > 3) return;
      const next = [...week2BracketSlotsArray];
      for (let i = 0; i < 12; i++) next[cardIndex * 12 + i] = slots[i] ?? "";
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        week2BracketSlots: JSON.stringify(next),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, week2BracketSlotsArray, setDashboardSettings]
  );

  /** Save the 6 Finals bracket slots. Persists to finalsBracketSlots JSON. */
  const saveFinalsBracketSlots = useCallback(
    (slots: string[]) => {
      if (!email || slots.length !== 6) return;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        finalsBracketSlots: JSON.stringify(slots),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, setDashboardSettings]
  );

  /** Save one Finals bracket score (matchIndex 0–2, side "top"|"bottom"). Persists to finalsBracketScores JSON. */
  const saveFinalsScoreChange = useCallback(
    (matchIndex: number, side: "top" | "bottom", value: string) => {
      if (!email || matchIndex < 0 || matchIndex > 2) return;
      const scoreIndex = matchIndex * 2 + (side === "top" ? 0 : 1);
      const next = [...finalsBracketScoresArray];
      next[scoreIndex] = value;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        finalsBracketScores: JSON.stringify(next),
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, finalsBracketScoresArray, setDashboardSettings]
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

  const randomizeWeek1Brackets = useCallback(() => {
    if (!email) return;
    setIsRandomizingBracket(true);
    window.setTimeout(() => {
      try {
        setRandomizeTooManyAttemptsOpen(false);
        setRandomizeSuccessModal(null);

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

        const slotEntries: [string, string][] = [];
        for (let cardIndex = 0; cardIndex < 8; cardIndex++) {
          const base = cardIndex * 12;
          const cardSlots = randomizedBracketCards[cardIndex] ?? Array(12).fill("");
          for (let i = 0; i < 12; i++) {
            slotEntries.push([
              `bracketSlot${base + i}`,
              cardSlots[i] ?? "",
            ]);
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

        setRandomizeSuccessModal(
          buildRandomizeWeek1SuccessModalPayload(
            randomizedBracketCards,
            teamByPlayer,
            teamDisplayByKey,
            playerRows
          )
        );
      } finally {
        setIsRandomizingBracket(false);
      }
    }, 0);
  }, [
    email,
    playerRows,
    selectedLeagueName,
    selectedSeason,
    tournamentStarted,
    tournamentPaused,
    setDashboardSettings,
  ]);

  const startTournament = useCallback(() => {
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentStarted: true,
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
    if (!email) return;
    setDashboardSettings({
      email,
      leagueName: selectedLeagueName,
      season: selectedSeason,
      tournamentPaused: !tournamentPaused,
    } as Parameters<typeof setDashboardSettings>[0]);
  }, [email, selectedLeagueName, selectedSeason, tournamentPaused, setDashboardSettings]);

  /** Persist collapsible open/closed state to Convex so it survives reload. */
  const persistUiCollapsed = useCallback(
    (patch: Record<string, boolean>) => {
      if (!email) return;
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        ...patch,
      } as Parameters<typeof setDashboardSettings>[0]);
    },
    [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, setDashboardSettings]
  );

  // Debounced save when any location or start date/time input changes (skip until we've applied initial settings from Convex so we don't overwrite with empty state)
  useEffect(() => {
    if (!email || !settingsQueryHasReturned.current || !hasAppliedInitialSettings.current) return;
    if (!selectedLeagueName || !selectedSeason) return;
    const t = setTimeout(() => {
      setDashboardSettings({
        email,
        leagueName: selectedLeagueName,
        season: selectedSeason,
        tournamentStarted,
        tournamentPaused,
        ...locations,
        locationStartMeta: locationStartMetaJson,
      } as Parameters<typeof setDashboardSettings>[0]);
    }, 400);
    return () => clearTimeout(t);
  }, [email, selectedLeagueName, selectedSeason, tournamentStarted, tournamentPaused, locations, locationStartMetaJson, setDashboardSettings]);

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
            tournamentStarted,
            tournamentPaused,
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
  }, [email, tournamentStarted, tournamentPaused, setDashboardSettings]);

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

  const SIDE_PANEL_TAB_WIDTH = 40;
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
    if (!sidePanelOpen || !sidePanelRef.current) return;
    const el = sidePanelRef.current;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setSidePanelMeasuredWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sidePanelOpen]);

  useLayoutEffect(() => {
    if (!sidePanelOpen || !setupScrollRef.current) return;
    const el = setupScrollRef.current;
    const update = () => {
      const hasScrollbar = el.scrollHeight > el.clientHeight;
      setSetupScrollbarPadding(hasScrollbar ? 12 : 0);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sidePanelOpen]);

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
      {/* Side card: inset from page padding, collapsible */}
      <aside
        ref={sidePanelRef}
        className="fixed z-30 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl transition-[width] duration-200 ease-out"
        style={{
          left: pageInsets.left,
          top: pageInsets.top,
          bottom: pageInsets.bottom,
          width: sidePanelOpen ? "max-content" : 0,
          maxWidth: sidePanelOpen ? `calc(100vw - ${pageInsets.left * 2}px)` : undefined,
        }}
        aria-hidden={!sidePanelOpen}
      >
        <div
          ref={setupScrollRef}
          className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-6 overflow-y-auto overflow-x-hidden p-4 pt-4"
          style={setupScrollbarPadding > 0 ? { paddingRight: 16 + setupScrollbarPadding } : undefined}
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="pl-[5px] text-[1.4rem] font-medium text-blue-400">Tournament Setup</span>
            <button
              type="button"
              onClick={() => setSidePanelOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-100/80 transition-colors hover:bg-white/10 hover:text-blue-100"
              aria-label="Collapse setup card"
            >
              <span aria-hidden>◀</span>
            </button>
          </div>
      {/* Users card – list of Convex users */}
      <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <button
          type="button"
          onClick={() => {
            setUsersCardOpen((o) => {
              const next = !o;
              persistUiCollapsed({ uiUsersCardOpen: next });
              return next;
            });
          }}
          className={`flex min-h-14 w-full cursor-pointer flex-shrink-0 items-center justify-between px-5 py-4 text-left transition-opacity hover:opacity-90 ${usersCardOpen ? "rounded-t-xl" : "rounded-xl"} bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900`}
          aria-expanded={usersCardOpen}
          aria-controls="users-card-body"
          id="users-card-heading"
        >
          <h2 className="text-lg font-semibold tracking-tight text-blue-100">
            Users {usersList != null ? `(${usersList.length})` : ""}
          </h2>
          <span className="text-blue-100/80" aria-hidden>
            {usersCardOpen ? "▼" : "▶"}
          </span>
        </button>
        {usersCardOpen && (
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
        )}
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

      {/* League & Season card – content height only, collapsible; width matches wider card */}
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
        <button
          type="button"
          onClick={() => {
            setLeagueCardOpen((o) => {
              const next = !o;
              persistUiCollapsed({ uiLeagueCardOpen: next });
              return next;
            });
          }}
          className={`flex min-h-14 w-full cursor-pointer flex-shrink-0 items-center justify-between px-5 py-4 text-left transition-opacity hover:opacity-90 ${leagueCardOpen ? "rounded-t-xl" : "rounded-xl"} bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900`}
          aria-expanded={leagueCardOpen}
          aria-controls="league-card-body"
          id="league-card-heading"
        >
          <h2 className="text-lg font-semibold tracking-tight text-blue-100">
            Tournament Settings
          </h2>
          <span className="text-blue-100/80" aria-hidden>
            {leagueCardOpen ? "▼" : "▶"}
          </span>
        </button>
        {leagueCardOpen && (
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
              {tournamentStarted && (
                <button
                  type="button"
                  onClick={togglePauseTournament}
                  className="cursor-pointer rounded-lg border border-green-400/50 bg-gradient-to-r from-green-800 to-green-600 px-4 py-2.5 text-sm font-medium text-green-100 shadow-sm transition-colors hover:from-green-700 hover:to-green-500 hover:border-green-300/60 disabled:opacity-55 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:border-slate-600"
                  aria-label={tournamentPaused ? "Resume Tournament" : "Pause Tournament"}
                >
                  {tournamentPaused ? "Resume Tournament" : "Pause Tournament"}
                </button>
              )}
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
                Randomly fill all Week 1 first-round brackets using the current player list? This will allow at most one bye per bracket, prevent bye-vs-bye matchups, avoid first-round matchups between players on the same team, and try to keep teammates at different Week 1 locations when possible.
              </p>
            </Modal>
            <Modal
              open={randomizeSuccessModal != null}
              onClose={() => setRandomizeSuccessModal(null)}
              title="Week 1 draw complete"
              titleDescription={
                randomizeSuccessModal ? (
                  <span className="block text-[1.75rem] leading-snug text-slate-400">
                    Teammates at same Week 1 location:{" "}
                    <span className="font-medium tabular-nums text-slate-200">
                      {randomizeSuccessModal.teammateConflicts.length}
                    </span>
                  </span>
                ) : undefined
              }
              panelClassName="max-w-2xl"
              footer={
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRandomizeSuccessModal(null)}
                    className="cursor-pointer rounded-lg border border-purple-400/50 bg-purple-800/80 px-4 py-2.5 text-sm font-medium text-purple-100 shadow-sm transition-colors hover:bg-purple-700/80"
                  >
                    Close
                  </button>
                </div>
              }
            >
              {randomizeSuccessModal && (
                <div className="max-h-[min(70vh,36rem)] space-y-5 overflow-y-auto pr-1 text-slate-200">
                  {randomizeSuccessModal.teammateConflicts.length > 0 && (
                    <div
                      className="rounded-lg border border-amber-500/30 bg-amber-950/25 p-4 text-sm"
                      role="region"
                      aria-label="Teammates at same location"
                    >
                      <p className="mb-3 font-medium text-amber-200">
                        Teammates at the same Week 1 location (
                        {randomizeSuccessModal.teammateConflicts.length}{" "}
                        {randomizeSuccessModal.teammateConflicts.length === 1 ? "case" : "cases"})
                      </p>
                      <ul className="space-y-2" role="list">
                        {randomizeSuccessModal.teammateConflicts.map((c, idx) => (
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
                    {randomizeSuccessModal.locations.map((loc) => (
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
                                className="min-w-0 truncate text-[0.8125rem] font-semibold leading-tight text-slate-100"
                                title={m.top}
                              >
                                {m.top}
                              </div>
                              <div className="py-1.5 text-left" aria-hidden>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-400">
                                  vs
                                </span>
                              </div>
                              <div
                                className="min-w-0 truncate text-[0.8125rem] font-semibold leading-tight text-slate-100"
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
              {/* Week 1 – collapsible */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWeek1SectionOpen((o) => {
                      const next = !o;
                      persistUiCollapsed({ uiWeek1SectionOpen: next });
                      return next;
                    });
                  }}
                  className="flex cursor-pointer items-center justify-center gap-2 text-xl font-semibold text-yellow-400 transition-opacity hover:opacity-90"
                  aria-expanded={week1SectionOpen}
                  aria-controls="league-card-week1-locations"
                >
                  Week 1
                  <span className="text-base" aria-hidden>
                    {week1SectionOpen ? "▼" : "▶"}
                  </span>
                </button>
                <div
                  id="league-card-week1-locations"
                  className={`flex flex-col gap-3 overflow-hidden transition-[max-height] duration-200 ease-out ${week1SectionOpen ? "max-h-[2200px] px-[5px] pb-[5px]" : "max-h-0 px-0 pb-0 pt-0"}`}
                  aria-hidden={!week1SectionOpen}
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
                        disabled={venuesLoading || tournamentStarted || tournamentPaused}
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
                          disabled={tournamentStarted || tournamentPaused}
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
                          disabled={tournamentStarted || tournamentPaused}
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
              {/* Week 2 – collapsible */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWeek2SectionOpen((o) => {
                      const next = !o;
                      persistUiCollapsed({ uiWeek2SectionOpen: next });
                      return next;
                    });
                  }}
                  className="flex cursor-pointer items-center justify-center gap-2 text-xl font-semibold text-yellow-400 transition-opacity hover:opacity-90"
                  aria-expanded={week2SectionOpen}
                  aria-controls="league-card-week2-locations"
                >
                  Week 2
                  <span className="text-base" aria-hidden>
                    {week2SectionOpen ? "▼" : "▶"}
                  </span>
                </button>
                <div
                  id="league-card-week2-locations"
                  className={`flex flex-col gap-3 overflow-hidden transition-[max-height] duration-200 ease-out ${week2SectionOpen ? "max-h-[1200px] px-[5px] pb-4" : "max-h-0 px-0 pb-0 pt-0"}`}
                  aria-hidden={!week2SectionOpen}
                >
                  {week2SectionOpen && WEEK_2_KEYS.map((key) => (
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
                        disabled={venuesLoading || tournamentStarted || tournamentPaused}
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
                          disabled={tournamentStarted || tournamentPaused}
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
                          disabled={tournamentStarted || tournamentPaused}
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
              {/* Finals – collapsible */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFinalsSectionOpen((o) => {
                      const next = !o;
                      persistUiCollapsed({ uiFinalsSectionOpen: next });
                      return next;
                    });
                  }}
                  className="flex cursor-pointer items-center justify-center gap-2 text-xl font-semibold text-yellow-400 transition-opacity hover:opacity-90"
                  aria-expanded={finalsSectionOpen}
                  aria-controls="league-card-finals-location"
                >
                  Finals
                  <span className="text-base" aria-hidden>
                    {finalsSectionOpen ? "▼" : "▶"}
                  </span>
                </button>
                <div
                  id="league-card-finals-location"
                  className={`flex flex-col gap-3 overflow-hidden transition-[max-height] duration-200 ease-out ${finalsSectionOpen ? "max-h-[200px] px-[5px] pb-[5px]" : "max-h-0 px-0 pb-0 pt-0"}`}
                  aria-hidden={!finalsSectionOpen}
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
                      disabled={venuesLoading || tournamentStarted || tournamentPaused}
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
                        disabled={tournamentStarted || tournamentPaused}
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
                        disabled={tournamentStarted || tournamentPaused}
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
        )}
      </div>

      {/* Players card – below League card, collapsible; same width as League card */}
      <div className="w-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black text-foreground">
        <div
          className="flex min-h-14 w-full flex-shrink-0 items-center justify-between gap-4 rounded-t-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-5 py-4"
          id="players-card-heading"
        >
          <div className="flex flex-1 items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-blue-100">
              Players ({playerRows.filter((r) => r.playerName !== BYE_LABEL).length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlayersCardOpen((o) => {
                const next = !o;
                persistUiCollapsed({ uiPlayersCardOpen: next });
                return next;
              });
            }}
            className="cursor-pointer rounded p-1 text-blue-100/80 transition-opacity hover:opacity-90"
            aria-expanded={playersCardOpen}
            aria-controls="players-card-body"
            aria-label={playersCardOpen ? "Collapse players" : "Expand players"}
          >
            {playersCardOpen ? "▼" : "▶"}
          </button>
        </div>
        <div
          id="players-card-body"
          aria-labelledby="players-card-heading"
          className={`transition-[max-height] duration-200 ease-out ${playersCardOpen ? "max-h-[4000px]" : "max-h-0 overflow-hidden"}`}
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

      {/* Tab to re-open side card when collapsed – same inset as card */}
      {!sidePanelOpen && (
        <button
          type="button"
          onClick={() => setSidePanelOpen(true)}
          className="fixed z-40 flex w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-slate-900 to-slate-950 text-blue-100/90 shadow-2xl transition-colors hover:from-slate-800 hover:to-slate-900 hover:text-blue-100"
          style={{
            left: pageInsets.left,
            top: pageInsets.top,
            bottom: pageInsets.bottom,
          }}
          aria-label="Open setup card"
        >
          <span aria-hidden>▶</span>
        </button>
      )}

      {/* Main content: bracket columns, with margin so they don’t sit under the panel/tab */}
      <div
        className="min-w-0 w-full overflow-x-hidden transition-[padding] duration-200 ease-out"
        style={{
          paddingLeft:
            pageInsets.left + (sidePanelOpen ? sidePanelMeasuredWidth : SIDE_PANEL_TAB_WIDTH),
        }}
      >
        <div className="min-w-0 overflow-x-auto">
          <div className="flex min-w-max flex-wrap gap-6 items-start">
      {/* Column 2: Week 1 location slot cards (8 cards) – all cards match width of widest (expanded) card */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        {WEEK_1_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground"
          >
            <div
              className={`flex min-h-14 w-full flex-shrink-0 flex-col gap-1 px-5 py-4 ${week1SlotCardsOpen[index] ? "rounded-t-xl" : "rounded-xl"} bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900`}
              id={`week1-slot-${index}-heading`}
            >
              <button
                type="button"
                onClick={() => {
                  setWeek1SlotCardsOpen((prev) => {
                    const next = [...prev];
                    next[index] = !next[index];
                    persistUiCollapsed({ [`uiWeek1Slot${index}Open`]: next[index] });
                    return next;
                  });
                }}
                className="flex min-w-0 cursor-pointer items-center justify-center gap-4 text-left transition-opacity hover:opacity-90"
                aria-expanded={week1SlotCardsOpen[index]}
                aria-controls={`week1-slot-${index}-body`}
                aria-label={week1SlotCardsOpen[index] ? "Collapse" : "Expand"}
              >
                <h2 className="min-w-0 truncate text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                  {locations[key]?.trim() || "TBD"}
                </h2>
                <span className="shrink-0 text-blue-100/80" aria-hidden>
                  {week1SlotCardsOpen[index] ? "▼" : "▶"}
                </span>
              </button>
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
            {week1SlotCardsOpen[index] && (
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
                  disabled={tournamentPaused}
                  matchStatusByIndex={getMatchStatusByIndex(index)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Column 3: Week 2 location slot cards (4 cards, 8-player brackets) – all cards match width of widest (expanded) card */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        {WEEK_2_KEYS.map((key, index) => (
          <div
            key={key}
            className="w-full min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground"
          >
            <div
              className={`flex min-h-14 w-full flex-shrink-0 flex-col gap-1 px-5 py-4 ${week2SlotCardsOpen[index] ? "rounded-t-xl" : "rounded-xl"} bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900`}
              id={`week2-slot-${index}-heading`}
            >
              <button
                type="button"
                onClick={() => {
                  setWeek2SlotCardsOpen((prev) => {
                    const next = [...prev];
                    next[index] = !next[index];
                    return next;
                  });
                }}
                className="flex min-w-0 cursor-pointer items-center justify-center gap-4 text-left transition-opacity hover:opacity-90"
                aria-expanded={week2SlotCardsOpen[index]}
                aria-controls={`week2-slot-${index}-body`}
                aria-label={week2SlotCardsOpen[index] ? "Collapse" : "Expand"}
              >
                <h2 className="min-w-0 truncate text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                  {locations[key]?.trim() || "TBD"}
                </h2>
                <span className="shrink-0 text-blue-100/80" aria-hidden>
                  {week2SlotCardsOpen[index] ? "▼" : "▶"}
                </span>
              </button>
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
            {week2SlotCardsOpen[index] && (
              <div
                id={`week2-slot-${index}-body`}
                aria-labelledby={`week2-slot-${index}-heading`}
                className="w-fit overflow-visible rounded-b-xl border-t border-white/40 bg-black pb-2 pt-2 pl-4"
              >
                <Bracket8TwoRounds
                  players={playerDisplayNames}
                  playerRaceToMap={Object.fromEntries(
                    playerRows.map((r) => [r.playerName, r.raceTo])
                  )}
                  initialSlotSelections={(() => {
                    const base = index * 12;
                    let byeNum = 0;
                    return Array.from({ length: 12 }, (_, i) => {
                      const val = week2BracketSlotsArray[base + i] ?? "";
                      if (val === BYE_LABEL) return `-- Bye ${++byeNum} --`;
                      return val;
                    });
                  })()}
                  onBracketSlotsChange={(slots) => saveWeek2BracketSlots(index, slots)}
                  cardIndex={index}
                  allFirstRoundSelections={allFirstRoundSelectionsWeek2}
                  disabled={tournamentPaused}
                  matchStatusByIndex={getWeek2MatchStatusByIndex(index)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Column 4: Finals (1 card, 4-person bracket) – same structure and styling as Week 2 cards */}
      <div className="flex w-max min-w-0 flex-col gap-6">
        <div className="w-max min-w-0 overflow-hidden rounded-xl border border-white/40 bg-black text-foreground">
          <div
            className={`flex min-h-14 w-full flex-shrink-0 flex-col gap-1 px-5 py-4 ${finalsCardOpen ? "rounded-t-xl" : "rounded-xl"} bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900`}
            id="finals-slot-heading"
          >
            <button
              type="button"
              onClick={() => setFinalsCardOpen((o) => !o)}
              className="flex min-w-0 cursor-pointer items-center justify-center gap-4 text-left transition-opacity hover:opacity-90"
              aria-expanded={finalsCardOpen}
              aria-controls="finals-slot-body"
              aria-label={finalsCardOpen ? "Collapse" : "Expand"}
            >
              <h2 className="min-w-0 truncate text-[1.6875rem] font-semibold tracking-tight text-yellow-400">
                {locations.finalsLocation?.trim() || "TBD"}
              </h2>
              <span className="shrink-0 text-blue-100/80" aria-hidden>
                {finalsCardOpen ? "▼" : "▶"}
              </span>
            </button>
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
          {finalsCardOpen && (
            <div
              id="finals-slot-body"
              aria-labelledby="finals-slot-heading"
              className="w-fit overflow-visible rounded-b-xl border-t border-white/40 bg-black pb-2 pt-2 pl-4"
            >
              <Bracket4
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
                disabled={tournamentPaused}
                matchStatusByIndex={getFinalsMatchStatusByIndex()}
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
          )}
        </div>
      </div>
        </div>
        </div>
      </div>
    </>
  );
}
