"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceToggle } from "@/components/stream/ObsSourcesPanel";

export type ObsCredentials = { host: string; port: string; password: string };

type ListResponse = {
  ok?: boolean;
  error?: string;
  items?: Array<{
    sceneName: string;
    sceneItemId: number;
    sourceName: string;
    sourceKind: string;
    sceneItemEnabled: boolean;
  }>;
};

/**
 * Loads program-scene items from OBS via the server API; toggles call SetSceneItemEnabled.
 */
export function useObsProgramSources(credentials: ObsCredentials | null, connected: boolean) {
  const [sources, setSources] = useState<SourceToggle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!credentials) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stream/obs/program-scene-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          host: credentials.host,
          port: credentials.port,
          password: credentials.password,
        }),
      });
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        setSources([]);
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const bad = data.items.some(
        (it) =>
          typeof it.sceneName !== "string" ||
          typeof it.sceneItemId !== "number" ||
          typeof it.sourceName !== "string"
      );
      if (bad) {
        setSources([]);
        setError("Invalid scene items from OBS.");
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
    } catch {
      setSources([]);
      setError("Network error — could not load scene sources.");
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  useEffect(() => {
    if (!connected || !credentials) {
      setSources([]);
      setError(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [connected, credentials, refetch]);

  const toggleSource = useCallback(
    async (item: SourceToggle) => {
      if (!credentials) return;
      const key = `${item.sceneName}:${item.sceneItemId}`;
      setTogglingKey(key);
      setError(null);
      const next = !item.visible;
      try {
        const res = await fetch("/api/stream/obs/set-scene-item-enabled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            host: credentials.host,
            port: credentials.port,
            password: credentials.password,
            sceneName: item.sceneName,
            sceneItemId: item.sceneItemId,
            sceneItemEnabled: next,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
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
    refetch,
    toggleSource,
    togglingKey,
  };
}
