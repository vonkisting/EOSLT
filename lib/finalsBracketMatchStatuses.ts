/** Finals bracket scores: JSON string[6] (same order as slots). */
export function parseFinalsBracketScoresJson(raw: unknown): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) {
    return Array(6).fill("0") as string[];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== 6) {
      return Array(6).fill("0") as string[];
    }
    return arr.map((v) => (typeof v === "string" ? v : "0"));
  } catch {
    return Array(6).fill("0") as string[];
  }
}

/** Finals bracket: 3 matchups (semis + final). Stored as JSON string[3] on dashboard settings. */
export function parseFinalsBracketMatchStatusesJson(raw: unknown): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) {
    return Array(3).fill("") as string[];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== 3) {
      return Array(3).fill("") as string[];
    }
    return arr.map((v) => (typeof v === "string" ? v : ""));
  } catch {
    return Array(3).fill("") as string[];
  }
}
