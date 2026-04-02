"use client";

import { useCallback, useEffect, useState } from "react";
import type { AudioChannel } from "@/components/stream/ObsAudioPanel";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

type ListResponse = {
  ok?: boolean;
  error?: string;
  inputs?: Array<{
    inputName: string;
    inputKind?: string;
    volume: number;
    muted: boolean;
  }>;
};

/**
 * Loads OBS audio-capable inputs (volume + mute) via server WebSocket calls.
 */
export function useObsAudioInputs(credentials: ObsCredentials | null, connected: boolean) {
  const [channels, setChannels] = useState<AudioChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!credentials) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stream/obs/audio-inputs", {
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
      if (!res.ok || !data.ok || !Array.isArray(data.inputs)) {
        setChannels([]);
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setChannels(
        data.inputs.map((row) => ({
          id: row.inputName,
          label: row.inputName,
          volume: Math.min(100, Math.max(0, Math.round(row.volume))),
          muted: row.muted === true,
        }))
      );
    } catch {
      setChannels([]);
      setError("Network error — could not load audio inputs.");
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  useEffect(() => {
    if (!connected || !credentials) {
      setChannels([]);
      setError(null);
      setLoading(false);
      return;
    }
    void refetch();
  }, [connected, credentials, refetch]);

  const setVolume = useCallback(
    async (inputName: string, volume: number) => {
      if (!credentials) return;
      setError(null);
      const v = Math.min(100, Math.max(0, Math.round(volume)));
      try {
        const res = await fetch("/api/stream/obs/set-input-volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            host: credentials.host,
            port: credentials.port,
            password: credentials.password,
            inputName,
            volume: v,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          await refetch();
          return;
        }
        setChannels((prev) =>
          prev.map((c) => (c.id === inputName ? { ...c, volume: v } : c))
        );
      } catch {
        setError("Network error — could not set volume.");
        await refetch();
      }
    },
    [credentials, refetch]
  );

  const setMute = useCallback(
    async (inputName: string, inputMuted: boolean) => {
      if (!credentials) return;
      setError(null);
      try {
        const res = await fetch("/api/stream/obs/set-input-mute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            host: credentials.host,
            port: credentials.port,
            password: credentials.password,
            inputName,
            inputMuted,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          await refetch();
          return;
        }
        setChannels((prev) =>
          prev.map((c) => (c.id === inputName ? { ...c, muted: inputMuted } : c))
        );
      } catch {
        setError("Network error — could not set mute.");
        await refetch();
      }
    },
    [credentials, refetch]
  );

  return { channels, loading, error, refetch, setVolume, setMute };
}
