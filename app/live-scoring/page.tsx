import { LiveScoringCard } from "@/components/live-scoring/LiveScoringCard";

export const dynamic = "force-dynamic";

/**
 * Live scoring page. Reached after "Start Live Scoring" from a matchup modal.
 * Query params: card (0–7), match (0–5). Header shows the two players and avatars.
 */
export default async function LiveScoringPage({
  searchParams,
}: {
  searchParams: Promise<{
    card?: string;
    match?: string;
    stage?: string;
    readonly?: string;
  }>;
}) {
  const params = await searchParams;
  const cardNum = parseInt(params.card ?? "", 10);
  const matchNum = parseInt(params.match ?? "", 10);
  const stage =
    params.stage === "week2" || params.stage === "finals" ? params.stage : "week1";
  const readOnly = params.readonly === "1";
  const cardIndex = Number.isNaN(cardNum)
    ? -1
    : Math.max(0, Math.min(stage === "week1" ? 7 : stage === "week2" ? 3 : 0, cardNum));
  const matchIndex = Number.isNaN(matchNum)
    ? -1
    : Math.max(0, Math.min(stage === "finals" ? 2 : 5, matchNum));

  return (
    <LiveScoringCard
      cardIndex={cardIndex}
      matchIndex={matchIndex}
      stage={stage}
      readOnly={readOnly}
    />
  );
}
