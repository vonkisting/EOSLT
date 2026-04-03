"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceToggle } from "@/components/stream/ObsSourcesPanel";
import { obsClientSetSceneItemEnabled } from "@/lib/stream-obs-client-actions";

export type ObsCredentials = { host: string; port: string; password: string };

type ListItem = {
  sceneName: string;
  sceneItemId: number;
  sourceName: string;
  sourceKind: string;
  sceneItemEnabled: boolean;
};

/**
 * Program scene sources; list data is loaded via {@link fetchObsPanelsSnapshot} from the parent.
 */
export function useObsProgramSources(credentials: ObsCredentials | null, connected: boolean) {
  const [sources, setSources] = useState<SourceToggle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const notifyPanelsRefetchStart = useCallback(() => {
    setError(null);
    setLoading(true);
  }, []);

  const ingestPanelsSnapshot = useCallback((data: { items: ListItem[] }) => {
    const bad = data.items.some(
      (it) =>
        typeof it.sceneName !== "string" ||
        typeof it.sceneItemId !== "number" ||
        typeof it.sourceName !== "string"
    );
    if (bad) {
      setSources([]);
      setError("Invalid scene items from OBS.");
      setLoading(false);
      return;
    }
    setSources(
      data.items.map((item) => ({
        sceneItemId: item.sceneItemId,
        sceneName: item.sceneName,
        sourceName: item.sourceName,
        sourceKind: item.sourceKind ?? "",
        visible: item.sceneItemEnabled === true,
      }))
    );
    setError(null);
    setLoading(false);
  }, []);

  const ingestPanelsRefetchError = useCallback((message: string) => {
    setSources([]);
    setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!connected || !credentials) {
      setSources([]);
      setError(null);
      setLoading(false);
    }
  }, [connected, credentials]);

  const toggleSource = useCallback(
    async (item: SourceToggle) => {
      if (!credentials) return;
      const key = `${item.sceneName}:${item.sceneItemId}`;
      setTogglingKey(key);
      setError(null);
      const next = !item.visible;
      try {
        const data = await obsClientSetSceneItemEnabled(credentials, {
          sceneName: item.sceneName,
          sceneItemId: item.sceneItemId,
          sceneItemEnabled: next,
        });
        if (!data.ok) {
          setError(data.error ?? "Could not update visibility.");
          return;
        }
        setSources((prev) =>
          prev.map((s) =>
            s.sceneItemId === item.sceneItemId && s.sceneName === item.sceneName
              ? { ...s, visible: next }
              : s
          )
        );
      } catch {
        setError("Network error — could not update visibility.");
      } finally {
        setTogglingKey(null);
      }
    },
    [credentials]
  );

  return {
    sources,
    loading,
    error,
    notifyPanelsRefetchStart,
    ingestPanelsSnapshot,
    ingestPanelsRefetchError,
    toggleSource,
    togglingKey,
  };
}
