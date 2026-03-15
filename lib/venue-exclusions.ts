/**
 * Shared venue exclusion logic for syncing from PoolHub into Convex.
 * Used by POST /api/sync-venues and by GET /api/venues when falling back.
 */

export const EXCLUDED_VENUES = new Set([
  "Backyard Grille",
  "Bahamas",
  "Bahama's",
  "Brickhause",
  "Congress Club",
  "Final Score",
  "Frank and Ernie's",
  "Kim's Barrel Inn",
  "Kims Barrel Inn",
  "Luckes",
  "North Point Pub",
  "Papa Joe's",
  "Springville",
  "The OT",
  "The Watering Hole",
  "Thirsty Arrow",
  "Top Hat",
]);

function normalizeForExclusion(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u2019|\u2018|\u0027/g, "'");
}

const excludedNormalized = new Set(
  [...EXCLUDED_VENUES].map((n) => normalizeForExclusion(n))
);

const CONTAINS_EXCLUDED = ["kim's barrel inn", "kims barrel inn"];

/**
 * Filter a list of venue names: remove excluded venues (and spelling variants).
 */
export function filterVenueNames(names: string[]): string[] {
  return names.filter((name) => {
    const n = normalizeForExclusion(name);
    if (excludedNormalized.has(n)) return false;
    if (CONTAINS_EXCLUDED.some((phrase) => n.includes(phrase))) return false;
    return true;
  });
}
