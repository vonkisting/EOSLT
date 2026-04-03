"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

/**
 * OBS scene list and program scene; data is loaded via {@link fetchObsPanelsSnapshot} from the parent.
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

  const notifyPanelsRefetchStart = useCallback(() => {
    setError(null);
    setLoading(true);
  }, []);

  const ingestPanelsSnapshot = useCallback(
    (data: { scenes: string[]; currentProgramSceneName: string | null }) => {
      setScenes(data.scenes);
      const cur =
        typeof data.currentProgramSceneName === "string" && data.currentProgramSceneName
          ? data.currentProgramSceneName
          : null;
      onSceneRef.current(cur);
      setError(null);
      setLoading(false);
    },
    []
  );

  const ingestPanelsRefetchError = useCallback((message: string) => {
    setScenes([]);
    setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!connected || !credentials) {
      setScenes([]);
      setError(null);
      setLoading(false);
    }
  }, [connected, credentials]);

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
    notifyPanelsRefetchStart,
    ingestPanelsSnapshot,
    ingestPanelsRefetchError,
    selectScene,
    switchingScene,
  };
}
