"use client";

import { useEffect, useRef } from "react";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { buildObsWebSocketUrl, parseObsPort } from "@/lib/stream-obs-url";

const DEBOUNCE_MS = 320;

/** OBS events that should refresh scene list, scene items, or audio inputs (debounced). */
const REFETCH_TRIGGER_EVENTS = [
  "CurrentProgramSceneChanged",
  "SceneListChanged",
  "SceneCreated",
  "SceneRemoved",
  "SceneItemCreated",
  "SceneItemRemoved",
  "SceneItemEnableStateChanged",
  "SceneItemListReindexed",
  "InputCreated",
  "InputRemoved",
  "InputNameChanged",
  "InputMuteStateChanged",
  "InputVolumeChanged",
] as const;

type ObsWsModule = typeof import("obs-websocket-js/json");

/**
 * Opens a second OBS WebSocket from the browser (LAN) to mirror server-driven fetches:
 * when OBS emits structural or mixer events, runs `refetchAll` after a short debounce.
 */
export function useObsRealtimeSync(
  credentials: ObsCredentials | null,
  enabled: boolean,
  refetchAll: () => void
) {
  const refetchRef = useRef(refetchAll);
  refetchRef.current = refetchAll;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !credentials) return;

    const port = parseObsPort(credentials.port);
    const url = port != null ? buildObsWebSocketUrl(credentials.host, port) : null;
    if (!url) return;

    let cancelled = false;
    let obs: InstanceType<ObsWsModule["default"]> | null = null;

    const scheduleRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        refetchRef.current();
      }, DEBOUNCE_MS);
    };

    void (async () => {
      let mod: ObsWsModule;
      try {
        mod = await import("obs-websocket-js/json");
      } catch {
        return;
      }
      if (cancelled) return;

      const { default: OBSWebSocket, EventSubscription } = mod;
      const client = new OBSWebSocket();
      try {
        await client.connect(url, credentials.password, {
          eventSubscriptions: EventSubscription.All,
        });
      } catch {
        return;
      }
      if (cancelled) {
        void client.disconnect();
        return;
      }

      obs = client;
      for (const ev of REFETCH_TRIGGER_EVENTS) {
        client.on(ev, scheduleRefetch);
      }
    })();

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (obs) {
        for (const ev of REFETCH_TRIGGER_EVENTS) {
          obs.off(ev, scheduleRefetch);
        }
        void obs.disconnect();
        obs = null;
      }
    };
  }, [enabled, credentials?.host, credentials?.port, credentials?.password]);
}
