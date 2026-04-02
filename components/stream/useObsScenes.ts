"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

type ScenesResponse = {
  ok?: boolean;
  error?: string;
  scenes?: string[];
  currentProgramSceneName?: string | null;
};

/**
 * Loads OBS scene list when connected; switching program scene calls the server API.
 */
export function useObsScenes(
  credentials: ObsCredentials | null,
  connected: boolean,
  onProgramSceneFromObs: (name: string | null) => void
) {
  const onSceneRef = useRef(onProgramSceneFromObs);
  onSceneRef.current = onProgramSceneFromObs;

  const [scenes, setScenes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingScene, setSwitchingScene] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!credentials) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stream/obs/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          host: credentials.host,
          port: credentials.port,
          password: credentials.password,
        }),
      });
      const data = (await res.json()) as ScenesResponse;
      if (!res.ok || !data.ok || !Array.isArray(data.scenes)) {
        setScenes([]);
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setScenes(data.scenes);
      const cur =
        typeof data.currentProgramSceneName === "string" && data.currentProgramSceneName
          ? data.currentProgramSceneName
          : null;
      onSceneRef.current(cur);
    } catch {
      setScenes([]);
      setError("Network error — could not load scenes.");
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  useEffect(() => {
    if (!connected || !credentials) {
      setScenes([]);
      setError(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [connected, credentials, refetch]);

  const selectScene = useCallback(
    async (sceneName: string) => {
      if (!credentials) return;
      setSwitchingScene(sceneName);
      setError(null);
      try {
        const res = await fetch("/api/stream/obs/set-program-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            host: credentials.host,
            port: credentials.port,
            password: credentials.password,
            sceneName,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          return;
        }
        onSceneRef.current(sceneName);
      } catch {
        setError("Network error — could not switch scene.");
      } finally {
        setSwitchingScene(null);
      }
    },
    [credentials]
  );

  return {
    scenes,
    loading,
    error,
    refetch,
    selectScene,
    switchingScene,
  };
}
