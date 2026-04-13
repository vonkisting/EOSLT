import {
  bracket4TargetSlotForWinner,
  finalsSlotIndexForWeek2FinalWinner,
  week1TargetSlotForWinner,
  week2SlotIndexForWeek1SemiWinner,
} from "@/lib/bracketMatchAdvance";
import {
  parseFinalsBracketMatchStatusesJson,
  parseFinalsBracketScoresJson,
  parseFinalsBracketSlotsJson,
} from "@/lib/finalsBracketMatchStatuses";
import type { LiveScoringStage } from "@/lib/liveScoringGlobalKey";
import { liveScoreGamesGlobalKey } from "@/lib/liveScoringGlobalKey";
import {
  FINALS_MATCH_FORFEIT_COUNT,
  mergeMatchForfeitSlotIntoArray,
  WEEK1_MATCH_FORFEIT_COUNT,
  WEEK2_MATCH_FORFEIT_COUNT,
} from "@/lib/matchForfeitsJson";
import {
  parseWeek2BracketMatchStatusesJson,
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
} from "@/lib/week2BracketSlots";

const GAME_COUNT = 11;

/** Empty per-game cells JSON stored in `liveScoreGames{n}` (same shape as live scoring UI). */
export function emptyLiveScoreGamesJson(): string {
  return JSON.stringify({
    p1: Array.from({ length: GAME_COUNT }, () => ""),
    p2: Array.from({ length: GAME_COUNT }, () => ""),
  });
}

/**
 * Fields to patch on shared dashboard settings for one matchup: clear live score grid,
 * zero race totals for that matchup, and clear matchup status (empty string, same as full tournament reset).
 */
export function buildMatchupResetPatch(
  stage: LiveScoringStage,
  cardIndex: number,
  matchIndex: number,
  settings: Record<string, unknown>
): Record<string, string> {
  const globalKey = liveScoreGamesGlobalKey(stage, cardIndex, matchIndex);
  const emptyGames = emptyLiveScoreGamesJson();
  const patch: Record<string, string> = {
    [`liveScoreGames${globalKey}`]: emptyGames,
  };

  if (stage === "week1") {
    patch[`bracketMatchStatus${cardIndex * 6 + matchIndex}`] = "";
    patch[`bracketScoreTop${globalKey}`] = "0";
    patch[`bracketScoreBottom${globalKey}`] = "0";
    patch.week1MatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.week1MatchForfeits,
      WEEK1_MATCH_FORFEIT_COUNT,
      cardIndex * 6 + matchIndex,
      ""
    );

    const w1Target = week1TargetSlotForWinner(matchIndex);
    if (w1Target != null) {
      patch[`bracketSlot${cardIndex * 12 + w1Target}`] = "";
    }
    const w2FromSemi = week2SlotIndexForWeek1SemiWinner(cardIndex, matchIndex);
    if (w2FromSemi != null) {
      const w2Slots = [...parseWeek2BracketSlotsJson(settings.week2BracketSlots)];
      if (w2FromSemi < w2Slots.length) {
        w2Slots[w2FromSemi] = "";
        patch.week2BracketSlots = JSON.stringify(w2Slots);
      }
    }
  } else if (stage === "week2") {
    const scores = parseWeek2BracketScoresJson(settings.week2BracketScores);
    const nextScores = [...scores];
    const base = cardIndex * 6;
    const si = base + matchIndex * 2;
    nextScores[si] = "0";
    nextScores[si + 1] = "0";
    patch.week2BracketScores = JSON.stringify(nextScores);

    const statuses = parseWeek2BracketMatchStatusesJson(settings.week2BracketMatchStatuses);
    const nextStatuses = [...statuses];
    const idx = cardIndex * 3 + matchIndex;
    nextStatuses[idx] = "";
    patch.week2BracketMatchStatuses = JSON.stringify(nextStatuses);
    patch.week2MatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.week2MatchForfeits,
      WEEK2_MATCH_FORFEIT_COUNT,
      cardIndex * 3 + matchIndex,
      ""
    );

    const w2Advance = bracket4TargetSlotForWinner(matchIndex);
    if (w2Advance != null) {
      const w2Slots = [...parseWeek2BracketSlotsJson(settings.week2BracketSlots)];
      const dest = base + w2Advance;
      if (dest < w2Slots.length) {
        w2Slots[dest] = "";
        patch.week2BracketSlots = JSON.stringify(w2Slots);
      }
    }
    if (matchIndex === 2) {
      const finalsIdx = finalsSlotIndexForWeek2FinalWinner(cardIndex);
      if (finalsIdx != null) {
        const finalsSlots = [...parseFinalsBracketSlotsJson(settings.finalsBracketSlots)];
        if (finalsIdx < finalsSlots.length) {
          finalsSlots[finalsIdx] = "";
          patch.finalsBracketSlots = JSON.stringify(finalsSlots);
        }
      }
    }
  } else {
    const scores = parseFinalsBracketScoresJson(settings.finalsBracketScores);
    const nextScores = [...scores];
    nextScores[matchIndex * 2] = "0";
    nextScores[matchIndex * 2 + 1] = "0";
    patch.finalsBracketScores = JSON.stringify(nextScores);

    const statuses = parseFinalsBracketMatchStatusesJson(settings.finalsBracketMatchStatuses);
    const nextStatuses = [...statuses];
    nextStatuses[matchIndex] = "";
    patch.finalsBracketMatchStatuses = JSON.stringify(nextStatuses);
    patch.finalsMatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.finalsMatchForfeits,
      FINALS_MATCH_FORFEIT_COUNT,
      matchIndex,
      ""
    );

    const finalsAdvance = bracket4TargetSlotForWinner(matchIndex);
    if (finalsAdvance != null) {
      const finalsSlots = [...parseFinalsBracketSlotsJson(settings.finalsBracketSlots)];
      if (finalsAdvance < finalsSlots.length) {
        finalsSlots[finalsAdvance] = "";
        patch.finalsBracketSlots = JSON.stringify(finalsSlots);
      }
    }
  }

  return patch;
}
