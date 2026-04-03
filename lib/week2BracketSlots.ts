import { isBye } from "@/components/Bracket8TwoRounds";

/** Total player-name slots: 4 cards × 6 (4-person bracket). */
export const WEEK2_BRACKET_SLOT_COUNT = 24;

/** Per-card slot count (semis + final placeholders). */
export const WEEK2_SLOTS_PER_CARD = 6;

const EMPTY_24 = () => Array(WEEK2_BRACKET_SLOT_COUNT).fill("") as string[];

function applyByeAdvancesSix(slots: string[]): string[] {
  const next = [...slots];
  while (next.length < 6) next.push("");
  const top0 = next[0]?.trim() ?? "";
  const bottom0 = next[1]?.trim() ?? "";
  const top1 = next[2]?.trim() ?? "";
  const bottom1 = next[3]?.trim() ?? "";

  if (!top0 || !bottom0) next[4] = "";
  else if (isBye(top0) && !isBye(bottom0)) next[4] = bottom0;
  else if (!isBye(top0) && isBye(bottom0)) next[4] = top0;
  else if (isBye(top0) && isBye(bottom0)) next[4] = "";

  if (!top1 || !bottom1) next[5] = "";
  else if (isBye(top1) && !isBye(bottom1)) next[5] = bottom1;
  else if (!isBye(top1) && isBye(bottom1)) next[5] = top1;
  else if (isBye(top1) && isBye(bottom1)) next[5] = "";

  return next;
}

/** Match index 0–2 → slot indices [top, bottom] within one 6-slot card. */
export function week2SlotPairIndices(matchIndex: number): [number, number] {
  const top = matchIndex * 2;
  return [top, top + 1];
}

function migrateLegacyCardTwelveToSix(old12: string[]): string[] {
  const a = old12.map((x) => (typeof x === "string" ? x : ""));
  const r2 = a.slice(8, 12);
  if (r2.some((v) => v.trim() !== "")) {
    return applyByeAdvancesSix([...r2.map((x) => x), "", ""]);
  }
  return applyByeAdvancesSix([
    a[0] ?? "",
    a[1] ?? "",
    a[2] ?? "",
    a[3] ?? "",
    "",
    "",
  ]);
}

/**
 * Parse `week2BracketSlots` JSON: 24 strings (current), or migrate legacy 48 (4×12).
 */
export function parseWeek2BracketSlotsJson(raw: unknown): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) return EMPTY_24();
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return EMPTY_24();
    if (arr.length === WEEK2_BRACKET_SLOT_COUNT) {
      return arr.map((v) => (typeof v === "string" ? v : ""));
    }
    if (arr.length === 48) {
      const out: string[] = [];
      for (let c = 0; c < 4; c++) {
        const slice = arr.slice(c * 12, c * 12 + 12).map((v) => (typeof v === "string" ? v : ""));
        out.push(...migrateLegacyCardTwelveToSix(slice));
      }
      return out;
    }
    return EMPTY_24();
  } catch {
    return EMPTY_24();
  }
}

export function parseWeek2BracketScoresJson(raw: unknown): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) {
    return Array(WEEK2_BRACKET_SLOT_COUNT).fill("0") as string[];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== WEEK2_BRACKET_SLOT_COUNT) {
      return Array(WEEK2_BRACKET_SLOT_COUNT).fill("0") as string[];
    }
    return arr.map((v) => (typeof v === "string" ? v : "0"));
  } catch {
    return Array(WEEK2_BRACKET_SLOT_COUNT).fill("0") as string[];
  }
}

export function parseWeek2BracketMatchStatusesJson(raw: unknown): string[] {
  if (raw == null || typeof raw !== "string" || !raw.trim()) {
    return Array(12).fill("") as string[];
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== 12) {
      return Array(12).fill("") as string[];
    }
    return arr.map((v) => (typeof v === "string" ? v : ""));
  } catch {
    return Array(12).fill("") as string[];
  }
}

export function emptyWeek2BracketScoresJson(): string {
  return JSON.stringify(Array(WEEK2_BRACKET_SLOT_COUNT).fill("0"));
}

export function emptyWeek2BracketMatchStatusesJson(): string {
  return JSON.stringify(Array(12).fill(""));
}
