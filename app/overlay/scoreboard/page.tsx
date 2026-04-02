import type { Metadata } from "next";
import { StreamScoreboardOverlayPageClient } from "@/components/stream/StreamScoreboardOverlayPageClient";

export const metadata: Metadata = {
  title: "Scoreboard overlay | EOSLT",
  description: "Browser source for EOSLT stream scoreboard",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ k?: string }>;
};

export default async function ScoreboardOverlayPage({ searchParams }: PageProps) {
  const { k } = await searchParams;
  const key = typeof k === "string" ? k.trim() : "";

  return <StreamScoreboardOverlayPageClient overlayKey={key} />;
}
