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
import { emptyLiveScoreGamesJson } from "@/lib/liveScoringMatchupReset";
import {
  parseWeek2BracketMatchStatusesJson,
  parseWeek2BracketScoresJson,
  parseWeek2BracketSlotsJson,
} from "@/lib/week2BracketSlots";

/**
 * Convex patch fields for marking a matchup completed, advancing `winnerName` when non-null.
 * Forfeit / 0–0 flow: empty per-game JSON and 0–0 bracket totals.
 * Normal submit: pass `finalScorecard` so per-game cells and match totals are kept on the record.
 */
export function buildMatchCompletionPatch(
  stage: LiveScoringStage,
  cardIndex: number,
  matchIndex: number,
  settings: Record<string, unknown>,
  winnerName: string | null,
  options?: {
    forfeitingPlayerName?: string | null;
    finalScorecard?: { liveGamesJson: string; total1: number; total2: number };
  }
): Record<string, unknown> {
  const globalKey = liveScoreGamesGlobalKey(stage, cardIndex, matchIndex);
  const finalCard = options?.finalScorecard;
  const topStored = finalCard ? String(finalCard.total1) : "0";
  const bottomStored = finalCard ? String(finalCard.total2) : "0";
  const patch: Record<string, unknown> = {
    [`liveScoreGames${globalKey}`]: finalCard
      ? finalCard.liveGamesJson
      : emptyLiveScoreGamesJson(),
  };
  const winner = winnerName?.trim() ? winnerName.trim() : null;

  if (stage === "week1") {
    patch[`bracketMatchStatus${cardIndex * 6 + matchIndex}`] = "Completed";
    patch[`bracketScoreTop${globalKey}`] = topStored;
    patch[`bracketScoreBottom${globalKey}`] = bottomStored;
    if (winner) {
      const targetSlot = week1TargetSlotForWinner(matchIndex);
      if (targetSlot != null) {
        patch[`bracketSlot${cardIndex * 12 + targetSlot}`] = winner;
      }
      const w2Idx = week2SlotIndexForWeek1SemiWinner(cardIndex, matchIndex);
      if (w2Idx != null) {
        const slots = parseWeek2BracketSlotsJson(settings.week2BracketSlots);
        const nextSlots = [...slots];
        if (w2Idx < nextSlots.length) {
          nextSlots[w2Idx] = winner;
          patch.week2BracketSlots = JSON.stringify(nextSlots);
        }
      }
    }
  } else if (stage === "week2") {
    const idx = cardIndex * 3 + matchIndex;
    const statuses = parseWeek2BracketMatchStatusesJson(settings.week2BracketMatchStatuses);
    const nextStatuses = [...statuses];
    nextStatuses[idx] = "Completed";
    patch.week2BracketMatchStatuses = JSON.stringify(nextStatuses);

    const scores = parseWeek2BracketScoresJson(settings.week2BracketScores);
    const nextScores = [...scores];
    const base = cardIndex * 6;
    const si = base + matchIndex * 2;
    nextScores[si] = topStored;
    nextScores[si + 1] = bottomStored;
    patch.week2BracketScores = JSON.stringify(nextScores);

    if (winner) {
      const targetSlot = bracket4TargetSlotForWinner(matchIndex);
      if (targetSlot != null) {
        const slots = parseWeek2BracketSlotsJson(settings.week2BracketSlots);
        const nextSlots = [...slots];
        if (base + targetSlot < nextSlots.length) {
          nextSlots[base + targetSlot] = winner;
          patch.week2BracketSlots = JSON.stringify(nextSlots);
        }
      }
      if (matchIndex === 2) {
        const finalsIdx = finalsSlotIndexForWeek2FinalWinner(cardIndex);
        if (finalsIdx != null) {
          const nextFinals = [...parseFinalsBracketSlotsJson(settings.finalsBracketSlots)];
          nextFinals[finalsIdx] = winner;
          patch.finalsBracketSlots = JSON.stringify(nextFinals);
        }
      }
    }
  } else {
    const statuses = parseFinalsBracketMatchStatusesJson(settings.finalsBracketMatchStatuses);
    const nextStatuses = [...statuses];
    nextStatuses[matchIndex] = "Completed";
    patch.finalsBracketMatchStatuses = JSON.stringify(nextStatuses);

    const scores = parseFinalsBracketScoresJson(settings.finalsBracketScores);
    const nextScores = [...scores];
    nextScores[matchIndex * 2] = topStored;
    nextScores[matchIndex * 2 + 1] = bottomStored;
    patch.finalsBracketScores = JSON.stringify(nextScores);

    if (winner) {
      const targetSlot = bracket4TargetSlotForWinner(matchIndex);
      if (targetSlot != null) {
        const nextSlots = [...parseFinalsBracketSlotsJson(settings.finalsBracketSlots)];
        if (targetSlot < nextSlots.length) {
          nextSlots[targetSlot] = winner;
          patch.finalsBracketSlots = JSON.stringify(nextSlots);
        }
      }
    }
  }

  const forfeitStored = options?.forfeitingPlayerName?.trim() ?? "";
  if (stage === "week1") {
    patch.week1MatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.week1MatchForfeits,
      WEEK1_MATCH_FORFEIT_COUNT,
      cardIndex * 6 + matchIndex,
      forfeitStored
    );
  } else if (stage === "week2") {
    patch.week2MatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.week2MatchForfeits,
      WEEK2_MATCH_FORFEIT_COUNT,
      cardIndex * 3 + matchIndex,
      forfeitStored
    );
  } else {
    patch.finalsMatchForfeits = mergeMatchForfeitSlotIntoArray(
      settings.finalsMatchForfeits,
      FINALS_MATCH_FORFEIT_COUNT,
      matchIndex,
      forfeitStored
    );
  }

  return patch;
}
