/**
 * Normalize pool/bracket names for comparison (trim, lowercase, collapse whitespace, NBSP → space).
 */
export function normalizeBracketParticipantName(name: string): string {
  return name
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Tokens for order-independent matching (handles "Last, First" vs "First Last"). */
function sortedNameTokens(name: string): string {
  const step = name
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[,.'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return step
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * True if two roster/bracket names refer to the same person: strict normalized equality,
 * or same word multiset (comma/period-insensitive).
 */
export function bracketParticipantNamesMatch(a: string, b: string): boolean {
  const na = normalizeBracketParticipantName(a);
  const nb = normalizeBracketParticipantName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return sortedNameTokens(a) === sortedNameTokens(b);
}

/** True when stored status means the matchup is finished (case-insensitive). */
export function bracketMatchStatusIsCompleted(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "completed";
}
