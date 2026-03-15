import { poolhubQuery } from "./poolhub-db";

/**
 * Fetch distinct venue names from Venue table for location dropdowns.
 * Uses column Name.
 */
export async function getVenueNames(): Promise<string[]> {
  const result = await poolhubQuery<{ Name: string }>(
    "SELECT DISTINCT Name FROM Venues ORDER BY Name"
  );
  const rows = result?.rows ?? [];
  const names = rows.map((r) => r.Name).filter((n): n is string => n != null && String(n).trim() !== "");
  return [...new Set(names)];
}

/**
 * Fetch distinct league names from Leagues table for the League Name dropdown.
 * Uses column Name. No duplicates.
 */
export async function getLeagueNames(): Promise<string[]> {
  const result = await poolhubQuery<{ Name: string }>(
    "SELECT DISTINCT Name FROM Leagues ORDER BY Name"
  );
  const rows = result?.rows ?? [];
  const names = rows.map((r) => r.Name).filter((n): n is string => n != null && n !== "");
  return [...new Set(names)];
}

/**
 * Fetch distinct Season values from Leagues table where Name matches the selected league.
 * Used to populate the Season dropdown. No duplicates.
 */
export async function getSeasonsByLeagueName(leagueName: string): Promise<string[]> {
  const result = await poolhubQuery<{ Season: string }>(
    "SELECT DISTINCT Season FROM Leagues WHERE Name = $1 ORDER BY Season",
    [leagueName]
  );
  const rows = result?.rows ?? [];
  const seasons = rows.map((r) => r.Season).filter((s): s is string => s != null && s !== "");
  return [...new Set(seasons)];
}

/**
 * Get the selected league's GUID from Leagues (Name + Season).
 * That GUID is then used to fetch players whose LeagueGUID matches.
 * Tries column LeagueGUID first, then GUID if the table uses that name.
 */
export async function getLeagueGuidByNameAndSeason(
  leagueName: string,
  season: string
): Promise<string | null> {
  const result = await poolhubQuery<{ LeagueGUID: string }>(
    "SELECT TOP 1 LeagueGUID FROM Leagues WHERE Name = $1 AND Season = $2",
    [leagueName, season]
  );
  const rows = result?.rows ?? [];
  let guid = rows[0]?.LeagueGUID;
  if (guid == null || guid === "") {
    const fallback = await poolhubQuery<{ GUID: string }>(
      "SELECT TOP 1 GUID FROM Leagues WHERE Name = $1 AND Season = $2",
      [leagueName, season]
    );
    const fallbackRows = fallback?.rows ?? [];
    guid = fallbackRows[0]?.GUID;
  }
  return guid != null && guid !== "" ? guid : null;
}

export type PlayerRow = {
  FirstName: string;
  LastName: string;
  Weeks: number | null;
  LegacyAve: number | null;
  RaceTo: number | null;
};

/**
 * Fetch all players from Players table whose LeagueGUID matches the selected league GUID.
 */
export async function getPlayersByLeagueGuid(leagueGuid: string): Promise<PlayerRow[]> {
  const result = await poolhubQuery<PlayerRow>(
    "SELECT FirstName, LastName, Weeks, LegacyAve, RaceTo FROM Players WHERE LeagueGUID = $1 ORDER BY LastName, FirstName",
    [leagueGuid]
  );
  return result?.rows ?? [];
}

/** Row from OverallPlayerStats table (column names may vary by schema). */
export type OverallPlayerStatsRow = Record<string, string | number | null | undefined>;

/**
 * Fetch all rows from OverallPlayerStats where LeagueGUID matches the selected league GUID.
 */
export async function getOverallPlayerStatsByLeagueGuid(
  leagueGuid: string
): Promise<OverallPlayerStatsRow[]> {
  const result = await poolhubQuery<OverallPlayerStatsRow>(
    "SELECT * FROM OverallPlayerStats WHERE LeagueGUID = $1",
    [leagueGuid]
  );
  return result?.rows ?? [];
}
