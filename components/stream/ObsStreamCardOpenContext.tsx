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
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";

type MapState = Record<string, boolean>;

function parseMap(json: string | null): MapState {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: MapState = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Connection card open state is not persisted. */
function stripConnectionFromMap(m: MapState): MapState {
  const { [STREAM_OBS_CARD_IDS.connection]: _removed, ...rest } = m;
  return rest;
}

type ObsStreamCardOpenContextValue = {
  getOpen: (cardId: string) => boolean;
  setOpen: (cardId: string, open: boolean) => void;
};

const ObsStreamCardOpenContext = createContext<ObsStreamCardOpenContextValue | null>(null);

type ObsStreamCardOpenProviderProps = {
  email: string;
  children: ReactNode;
};

/**
 * Persists which stream OBS dashboard cards and nested sections are expanded (per user, Convex
 * `streamObsUiState.cardOpenByIdJson`). Add a stable id in `STREAM_OBS_CARD_IDS` for each stream card.
 * Stream cards are always expanded in the UI; this map remains for compatibility with persisted state.
 */
export function ObsStreamCardOpenProvider({ email, children }: ObsStreamCardOpenProviderProps) {
  const normalized = email.toLowerCase().trim();
  const savedRow = useQuery(api.streamObsUiState.get, { email: normalized });
  const setMapMutation = useMutation(api.streamObsUiState.setCardOpenMap);

  const [local, setLocal] = useState<MapState>({});
  const initializedFromServer = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedRow === undefined) return;
    if (!initializedFromServer.current) {
      initializedFromServer.current = true;
      setLocal({
        ...stripConnectionFromMap(parseMap(savedRow.cardOpenByIdJson)),
        [STREAM_OBS_CARD_IDS.connection]: true,
      });
    }
  }, [savedRow]);

  const flushSave = useCallback(
    (next: MapState) => {
      void setMapMutation({
        email: normalized,
        cardOpenByIdJson: JSON.stringify(stripConnectionFromMap(next)),
      });
    },
    [normalized, setMapMutation]
  );

  const scheduleSave = useCallback(
    (next: MapState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => flushSave(next), 400);
    },
    [flushSave]
  );

  const setOpen = useCallback(
    (cardId: string, open: boolean) => {
      setLocal((prev) => {
        const prevOpen = prev[cardId] !== undefined ? prev[cardId] : true;
        if (prevOpen === open) return prev;
        const next = { ...prev, [cardId]: open };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const getOpen = useCallback(
    (cardId: string) => {
      const v = local[cardId];
      return v !== undefined ? v : true;
    },
    [local]
  );

  const value = useMemo(
    () => ({
      getOpen,
      setOpen,
    }),
    [getOpen, setOpen]
  );

  return (
    <ObsStreamCardOpenContext.Provider value={value}>{children}</ObsStreamCardOpenContext.Provider>
  );
}

export function useObsStreamCardOpen(cardId: string) {
  const ctx = useContext(ObsStreamCardOpenContext);
  if (!ctx) {
    throw new Error("useObsStreamCardOpen must be used within ObsStreamCardOpenProvider");
  }
  const setOpen = useCallback(
    (next: boolean) => {
      ctx.setOpen(cardId, next);
    },
    [ctx.setOpen, cardId]
  );
  return {
    open: ctx.getOpen(cardId),
    setOpen,
  };
}
