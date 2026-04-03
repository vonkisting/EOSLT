import type { Metadata } from "next";
import { StreamTournamentResultsOverlayPageClient } from "@/components/stream/StreamTournamentResultsOverlayPageClient";

export const metadata: Metadata = {
  title: "Tournament results overlay | EOSLT",
  description: "Browser source for EOSLT tournament results",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ k?: string }>;
};

export default async function ResultsOverlayPage({ searchParams }: PageProps) {
  const { k } = await searchParams;
  const key = typeof k === "string" ? k.trim() : "";

  return <StreamTournamentResultsOverlayPageClient overlayKey={key} />;
}
