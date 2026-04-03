"use client";

import { useCallback, useEffect, useState } from "react";
import type { AudioChannel } from "@/components/stream/ObsAudioPanel";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import {
  obsClientAudioInputs,
  obsClientSetInputMute,
  obsClientSetInputVolume,
} from "@/lib/stream-obs-client-actions";

/**
 * OBS audio inputs; list data is loaded via {@link fetchObsPanelsSnapshot} from the parent.
 * @param refetchPanels - Batched OBS refresh (e.g. after a failed mute/volume call).
 */
export function useObsAudioInputs(
  credentials: ObsCredentials | null,
  connected: boolean,
  refetchPanels?: () => Promise<void>
) {
  const [channels, setChannels] = useState<AudioChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notifyPanelsRefetchStart = useCallback(() => {
    setError(null);
    setLoading(true);
  }, []);

  const ingestPanelsSnapshot = useCallback(
    (data: {
      inputs: Array<{
        inputName: string;
        inputKind?: string;
        volume: number;
        muted: boolean;
      }>;
    }) => {
      setChannels(
        data.inputs.map((row) => ({
          id: row.inputName,
          label: row.inputName,
          volume: Math.min(100, Math.max(0, Math.round(row.volume))),
          muted: row.muted === true,
        }))
      );
      setError(null);
      setLoading(false);
    },
    []
  );

  const ingestPanelsRefetchError = useCallback((message: string) => {
    setChannels([]);
    setError(message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!connected || !credentials) {
      setChannels([]);
      setError(null);
      setLoading(false);
    }
  }, [connected, credentials]);

  const resyncFromObs = useCallback(async () => {
    if (refetchPanels) {
      await refetchPanels();
      return;
    }
    if (!credentials) return;
    setError(null);
    setLoading(true);
    try {
      const data = await obsClientAudioInputs(credentials);
      if (!data.ok || !Array.isArray(data.inputs)) {
        setChannels([]);
        setError(data.error ?? "Could not load audio inputs.");
        setLoading(false);
        return;
      }
      ingestPanelsSnapshot({ inputs: data.inputs });
    } catch {
      setChannels([]);
      setError("Network error — could not load audio inputs.");
      setLoading(false);
    }
  }, [credentials, refetchPanels, ingestPanelsSnapshot]);

  const setVolume = useCallback(
    async (inputName: string, volume: number) => {
      if (!credentials) return;
      setError(null);
      const v = Math.min(100, Math.max(0, Math.round(volume)));
      try {
        const data = await obsClientSetInputVolume(credentials, inputName, v);
        if (!data.ok) {
          setError(data.error ?? "Could not set volume.");
          await resyncFromObs();
          return;
        }
        setChannels((prev) =>
          prev.map((c) => (c.id === inputName ? { ...c, volume: v } : c))
        );
      } catch {
        setError("Network error — could not set volume.");
        await resyncFromObs();
      }
    },
    [credentials, resyncFromObs]
  );

  const setMute = useCallback(
    async (inputName: string, inputMuted: boolean) => {
      if (!credentials) return;
      setError(null);
      try {
        const data = await obsClientSetInputMute(credentials, inputName, inputMuted);
        if (!data.ok) {
          setError(data.error ?? "Could not set mute.");
          await resyncFromObs();
          return;
        }
        setChannels((prev) =>
          prev.map((c) => (c.id === inputName ? { ...c, muted: inputMuted } : c))
        );
      } catch {
        setError("Network error — could not set mute.");
        await resyncFromObs();
      }
    },
    [credentials, resyncFromObs]
  );

  return {
    channels,
    loading,
    error,
    notifyPanelsRefetchStart,
    ingestPanelsSnapshot,
    ingestPanelsRefetchError,
    setVolume,
    setMute,
  };
}
