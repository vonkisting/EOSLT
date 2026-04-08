/** Week 1: 0–47; Week 2: 48–59 (12); Finals: 60–62 (3). Same `liveScoreGames{n}` JSON as Week 1. */
export type LiveScoringStage = "week1" | "week2" | "finals";

export function liveScoreGamesGlobalKey(
  stage: LiveScoringStage,
  cardIndex: number,
  matchIndex: number
): number {
  if (stage === "week1") return cardIndex * 6 + matchIndex;
  if (stage === "week2") return 48 + cardIndex * 3 + matchIndex;
  return 60 + matchIndex;
}
