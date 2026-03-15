import { LiveScoringCard } from "@/components/live-scoring/LiveScoringCard";

export const dynamic = "force-dynamic";

/**
 * Live scoring page. Reached after "Start Live Scoring" from a matchup modal.
 * Query params: card (0–7), match (0–5). Header shows the two players and avatars.
 */
export default async function LiveScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; match?: string }>;
}) {
  const params = await searchParams;
  const cardNum = parseInt(params.card ?? "", 10);
  const matchNum = parseInt(params.match ?? "", 10);
  const cardIndex = Number.isNaN(cardNum)
    ? -1
    : Math.max(0, Math.min(7, cardNum));
  const matchIndex = Number.isNaN(matchNum)
    ? -1
    : Math.max(0, Math.min(5, matchNum));

  return <LiveScoringCard cardIndex={cardIndex} matchIndex={matchIndex} />;
}
