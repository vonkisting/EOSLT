"use client";

import { useMemo, type RefObject } from "react";
import { StreamObsCardChrome } from "@/components/stream/StreamObsCardChrome";
import {
  StreamObsGridCardById,
  type StreamObsGridCardByIdProps,
} from "@/components/stream/streamObsGridCardById";
import { useStreamObsLayout } from "@/components/stream/StreamObsLayoutContext";
import { tournamentPlayerDisplayNames } from "@/components/stream/tournamentSettingsDefaults";
import { useObsRealtimeSync } from "@/components/stream/useObsRealtimeSync";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

export type StreamObsConnectedPanelsProps = Omit<
  StreamObsGridCardByIdProps,
  "cardId" | "tournamentPlayerNames"
> & {
  obsCredentials: ObsCredentials;
};

export function StreamObsConnectedPanels(props: StreamObsConnectedPanelsProps) {
  const { obsCredentials, ...gridProps } = props;
  const { columns, moveCardToColumnEnd } = useStreamObsLayout();

  useObsRealtimeSync(obsCredentials, true, props.onRefreshObsPanels);

  const tournamentPlayerNames = useMemo(
    () => tournamentPlayerDisplayNames(props.tournamentSettings),
    [props.tournamentSettings]
  );

  const cardProps: Omit<StreamObsGridCardByIdProps, "cardId"> = {
    ...gridProps,
    tournamentPlayerNames,
  };

  return (
    <div className="mt-6 grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((ids, colIndex) => (
        <div
          key={colIndex}
          className={`flex min-w-0 flex-col gap-4 ${colIndex === 2 ? "md:col-span-2 xl:col-span-1" : ""}`}
          onDragOver={(e) => e.preventDefault()}
        >
          {ids.map((cardId) => (
            <StreamObsCardChrome key={cardId} cardId={cardId}>
              <StreamObsGridCardById cardId={cardId} {...cardProps} />
            </StreamObsCardChrome>
          ))}
          <div
            className="flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-2 py-2 text-center text-[10px] text-slate-600"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) moveCardToColumnEnd(id, colIndex);
            }}
          >
            Drop here for end of column
          </div>
        </div>
      ))}
    </div>
  );
}
