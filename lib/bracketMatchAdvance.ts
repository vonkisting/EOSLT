/**
 * Week 1 (8-player card, 12 slots): R1 matchups 0–3 feed winners into the next column at slots 8–11.
 * Semifinals (match index 4–5) have no further slot on the same card.
 */
export function week1TargetSlotForWinner(matchIndex: number): number | null {
  if (matchIndex >= 0 && matchIndex <= 3) return 8 + matchIndex;
  return null;
}

/**
 * Week 1 semifinal winners (match 4 = first semi on the Week 1 card, match 5 = second semi) feed into
 * Week 2 four-person brackets: two consecutive Week 1 cards → one Week 2 card.
 * - Week 1 cards 0 & 1 → Week 2 card 0 (matchup 0 = slots 0–1, matchup 1 = slots 2–3)
 * - Week 1 cards 2 & 3 → Week 2 card 1, etc.
 * Match 4 winner → top slot of that pair; match 5 winner → bottom slot.
 */
export function week2SlotIndexForWeek1SemiWinner(
  week1CardIndex: number,
  week1MatchIndex: number
): number | null {
  if (week1MatchIndex !== 4 && week1MatchIndex !== 5) return null;
  if (week1CardIndex < 0 || week1CardIndex > 7) return null;
  const w2Card = Math.floor(week1CardIndex / 2);
  const matchupOnW2Card = week1CardIndex % 2;
  const base = w2Card * 6;
  const offsetWithinPair = week1MatchIndex === 4 ? 0 : 1;
  return base + matchupOnW2Card * 2 + offsetWithinPair;
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

/**
 * 4-person bracket (Week 2 card or Finals): semis feed slots 4–5; final has no further slot on the same bracket.
 */
export function bracket4TargetSlotForWinner(matchIndex: number): number | null {
  if (matchIndex === 0) return 4;
  if (matchIndex === 1) return 5;
  return null;
}
