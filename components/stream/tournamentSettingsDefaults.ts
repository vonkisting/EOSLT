/** Finish bracket labels for each tournament player row (stream dashboard). */
export const TOURNAMENT_PLAYER_PLACEMENT_OPTIONS = [
  "13th - 16th",
  "9th - 12th",
  "7th - 8th",
  "5th - 6th",
  "4th",
  "3rd",
  "Runner-Up",
  "Champion",
] as const;

/**
 * Fixed 16-row results grid (placement column). Matches bracket capacity; player names fill
 * the first free row for each placement in tournament player list order.
 */
export const TOURNAMENT_RESULTS_ROW_PLACEMENTS: readonly string[] = [
  "13th - 16th",
  "13th - 16th",
  "13th - 16th",
  "13th - 16th",
  "9th - 12th",
  "9th - 12th",
  "9th - 12th",
  "9th - 12th",
  "7th - 8th",
  "7th - 8th",
  "5th - 6th",
  "5th - 6th",
  "4th",
  "3rd",
  "Runner-Up",
  "Champion",
];

/** Map legacy or alternate saved labels to the canonical option string for results slots. */
export function canonicalTournamentPlacement(placement: string): string {
  const t = placement.trim();
  if (t === "5th - 5th") return "5th - 6th";
  return t;
}

export type TournamentPlayerRow = {
  id: string;
  name: string;
  /** Selected finish bracket; empty string = none chosen. */
  placement: string;
};

export type TournamentSettingsState = {
  name: string;
  players: TournamentPlayerRow[];
};

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettingsState = {
  name: "",
  players: [],
};

function newRow(name: string): TournamentPlayerRow {
  return { id: crypto.randomUUID(), name, placement: "" };
}

function parsePlayerEntry(item: unknown): TournamentPlayerRow | null {
  if (typeof item === "string") return newRow(item);
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : "";
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id : crypto.randomUUID();
  let placement = typeof rec.placement === "string" ? rec.placement : "";
  if (placement === "5th - 5th") placement = "5th - 6th";
  return { id, name, placement };
}

export function parseTournamentSettingsJson(json: string | undefined | null): TournamentSettingsState {
  if (!json?.trim()) return DEFAULT_TOURNAMENT_SETTINGS;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    let raw: unknown[] = [];
    if (Array.isArray(o.players)) raw = o.players;
    else if (Array.isArray(o.playerNames)) raw = o.playerNames;

    const players: TournamentPlayerRow[] = [];
    for (const item of raw) {
      const row = parsePlayerEntry(item);
      if (row) players.push(row);
    }

    return { name, players };
  } catch {
    return DEFAULT_TOURNAMENT_SETTINGS;
  }
}

export function tournamentSettingsToJson(state: TournamentSettingsState): string {
  return JSON.stringify({
    name: state.name,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      placement: p.placement,
    })),
  });
}

export function createEmptyPlayerRow(): TournamentPlayerRow {
  return newRow("");
}

/** Non-empty unique display names from the tournament player rows (scoreboard dropdown options). */
export function tournamentPlayerDisplayNames(settings: TournamentSettingsState): string[] {
  const names = settings.players.map((p) => p.name.trim()).filter(Boolean);
  return [...new Set(names)];
}

export function tournamentSettingsLooksEmpty(settings: TournamentSettingsState): boolean {
  if (settings.name.trim()) return false;
  return !settings.players.some((p) => p.name.trim() || p.placement.trim());
}

/**
 * When Convex briefly returns empty tournament JSON, keep the last non-empty snapshot (OBS overlay).
 */
export function mergeOverlayTournamentWithSnapshot(
  parsed: TournamentSettingsState,
  snapshot: TournamentSettingsState,
): TournamentSettingsState {
  if (tournamentSettingsLooksEmpty(parsed) && !tournamentSettingsLooksEmpty(snapshot)) {
    return snapshot;
  }
  return parsed;
}
