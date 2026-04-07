/**
 * Week 1 (8-player card, 12 slots): R1 matchups 0–3 feed winners into the next column at slots 8–11.
 * Semifinals (match index 4–5) have no further slot on the same card.
 */
export function week1TargetSlotForWinner(matchIndex: number): number | null {
  if (matchIndex >= 0 && matchIndex <= 3) return 8 + matchIndex;
  return null;
}

/**
 * Resolves the winner for Convex bracket slot updates when a match is marked completed.
 * Prefers the single-winner from race-to rules when set; otherwise uses higher ball total.
 */
export function resolveWinnerNameForAdvancement(
  singleWinnerName: string | null,
  player1Name: string,
  player2Name: string,
  displayTotal1: number,
  displayTotal2: number
): string | null {
  if (singleWinnerName && singleWinnerName.trim() !== "" && singleWinnerName !== "—") {
    return singleWinnerName;
  }
  const p1 = player1Name.trim();
  const p2 = player2Name.trim();
  if (!p1 || p1 === "—" || !p2 || p2 === "—") return null;
  if (displayTotal1 > displayTotal2) return player1Name;
  if (displayTotal2 > displayTotal1) return player2Name;
  return null;
}
