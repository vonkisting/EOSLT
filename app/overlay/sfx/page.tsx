import type { Metadata } from "next";
import { StreamSfxOverlayPageClient } from "@/components/stream/StreamSfxOverlayPageClient";

export const metadata: Metadata = {
  title: "Stream SFX overlay | EOSLT",
  description: "Browser source for EOSLT stream sound effects",
};

type PageProps = {
  searchParams: Promise<{ k?: string }>;
};

export default async function StreamSfxOverlayPage({ searchParams }: PageProps) {
  const { k } = await searchParams;
  const key = typeof k === "string" ? k.trim() : "";

  return <StreamSfxOverlayPageClient overlayKey={key} />;
}
