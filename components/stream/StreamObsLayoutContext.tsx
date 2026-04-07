"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  defaultStreamObsLayout,
  parseStreamObsLayoutJson,
  serializeStreamObsLayout,
  type StreamObsCardSize,
  type StreamObsLayoutStateV1,
} from "@/lib/streamObsLayout";

type StreamObsLayoutContextValue = {
  columns: [string[], string[], string[]];
  moveCardBefore: (draggedId: string, beforeId: string) => void;
  moveCardToColumnEnd: (draggedId: string, colIndex: number) => void;
  getSize: (cardId: string) => StreamObsCardSize | undefined;
};

const StreamObsLayoutContext = createContext<StreamObsLayoutContextValue | null>(null);

function stripId(cols: [string[], string[], string[]], id: string): [string[], string[], string[]] {
  return [cols[0].filter((x) => x !== id), cols[1].filter((x) => x !== id), cols[2].filter((x) => x !== id)];
}

type StreamObsLayoutProviderProps = {
  email: string;
  children: ReactNode;
};

export function StreamObsLayoutProvider({ email, children }: StreamObsLayoutProviderProps) {
  const normalized = email.toLowerCase().trim();
  const row = useQuery(api.streamObsUiState.get, { email: normalized });
  const setLayoutMutation = useMutation(api.streamObsUiState.setLayoutJson);

  const [state, setState] = useState<StreamObsLayoutStateV1>(defaultStreamObsLayout);
  const hydratedRef = useRef(false);
  const layoutDirtyRef = useRef(false);

  useEffect(() => {
    if (row === undefined) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      setState(parseStreamObsLayoutJson(row.layoutJson));
    }
  }, [row]);

  useEffect(() => {
    if (!layoutDirtyRef.current) return;
    const t = setTimeout(() => {
      void setLayoutMutation({
        email: normalized,
        layoutJson: serializeStreamObsLayout(state),
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, normalized, setLayoutMutation]);

  const markDirty = useCallback(() => {
    layoutDirtyRef.current = true;
  }, []);

  const moveCardBefore = useCallback(
    (draggedId: string, beforeId: string) => {
      if (draggedId === beforeId) return;
      markDirty();
      setState((prev) => {
        const nextCols = stripId(prev.columns, draggedId);
        for (let c = 0; c < 3; c++) {
          const idx = nextCols[c].indexOf(beforeId);
          if (idx !== -1) {
            nextCols[c].splice(idx, 0, draggedId);
            return { ...prev, columns: nextCols };
          }
        }
        return prev;
      });
    },
    [markDirty]
  );

  const moveCardToColumnEnd = useCallback(
    (draggedId: string, colIndex: number) => {
      if (colIndex < 0 || colIndex > 2) return;
      markDirty();
      setState((prev) => {
        const nextCols = stripId(prev.columns, draggedId);
        nextCols[colIndex].push(draggedId);
        return { ...prev, columns: nextCols };
      });
    },
    [markDirty]
  );

  const getSize = useCallback(
    (cardId: string) => state.sizes[cardId],
    [state.sizes]
  );

  const value = useMemo<StreamObsLayoutContextValue>(
    () => ({
      columns: state.columns,
      moveCardBefore,
      moveCardToColumnEnd,
      getSize,
    }),
    [state.columns, moveCardBefore, moveCardToColumnEnd, getSize]
  );

  return (
    <StreamObsLayoutContext.Provider value={value}>{children}</StreamObsLayoutContext.Provider>
  );
}

export function useStreamObsLayout(): StreamObsLayoutContextValue {
  const ctx = useContext(StreamObsLayoutContext);
  if (!ctx) {
    throw new Error("useStreamObsLayout must be used within StreamObsLayoutProvider");
  }
  return ctx;
}
