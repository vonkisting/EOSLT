import { bracketParticipantNamesMatch } from "@/lib/bracketNameMatch";

export const WEEK1_MATCH_FORFEIT_COUNT = 48;
export const WEEK2_MATCH_FORFEIT_COUNT = 12;
export const FINALS_MATCH_FORFEIT_COUNT = 3;

/** Parse JSON string array of forfeiting player names per matchup index; missing entries become "". */
export function parseMatchForfeitsJson(raw: unknown, length: number): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) {
    return Array.from({ length }, () => "");
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      return Array.from({ length }, () => "");
    }
    return Array.from({ length }, (_, i) =>
      typeof arr[i] === "string" ? String(arr[i]) : ""
    );
  } catch {
    return Array.from({ length }, () => "");
  }
}

/** Stored bracket name with optional " (Forfeit)" when it matches the forfeiting player for that side. */
export function displayNameWithForfeitSuffix(
  bracketSlotName: string,
  forfeitingPlayerName: string | null | undefined
): string {
  const name = bracketSlotName.trim();
  if (!name) return "";
  if (!forfeitingPlayerName?.trim()) return name;
  return bracketParticipantNamesMatch(name, forfeitingPlayerName)
    ? `${name} (Forfeit)`
    : name;
}

/** Update one index in a forfeits JSON array and return stringified JSON for Convex. */
export function mergeMatchForfeitSlotIntoArray(
  raw: unknown,
  length: number,
  index: number,
  value: string
): string {
  const arr = parseMatchForfeitsJson(raw, length);
  if (index >= 0 && index < length) {
    arr[index] = value;
  }
  return JSON.stringify(arr);
}
