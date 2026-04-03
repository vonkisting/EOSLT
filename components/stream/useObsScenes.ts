"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { obsClientSetProgramScene } from "@/lib/stream-obs-client-actions";

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
        const data = await obsClientSetProgramScene(credentials, sceneName);
        if (!data.ok) {
          setError(data.error ?? "Could not switch scene.");
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
