"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ObsConnectionPanel } from "@/components/stream/ObsConnectionPanel";
import { ObsStreamCardOpenProvider } from "@/components/stream/ObsStreamCardOpenContext";
import { StreamObsConnectedPanels } from "@/components/stream/StreamObsConnectedPanels";
import { useObsAudioInputs } from "@/components/stream/useObsAudioInputs";
import {
  type ObsCredentials,
  useObsProgramSources,
} from "@/components/stream/useObsProgramSources";
import { StreamObsPageHeader } from "@/components/stream/StreamObsPageHeader";
import { useStreamObsPersistedForm } from "@/components/stream/useStreamObsPersistedForm";
import { formatStreamSfxButtonLabel } from "@/lib/stream-sfx-basename";

type StreamObsDashboardProps = {
  userEmail: string;
  userName: string | null;
  /** Basenames of `public/stream-sfx/*.mp3` discovered at request time. */
  sfxBasenames: string[];
};

/**
 * Stream OBS dashboard: connection is verified via POST /api/stream/obs/connect (server → OBS WebSocket).
 * Named connection profiles persist to Convex when Connection name is set.
 */
export function StreamObsDashboard({ userEmail, userName, sfxBasenames }: StreamObsDashboardProps) {
  const normalizedEmail = userEmail.toLowerCase().trim();

  const soundboardEffects = useMemo(
    () =>
      sfxBasenames.map((id) => ({
        id,
        label: formatStreamSfxButtonLabel(id),
      })),
    [sfxBasenames]
  );

  const {
    connectionName,
    setConnectionName,
    saveProfileNow,
    savedConnectionNames,
    host,
    setHost,
    port,
    setPort,
    password,
    setPassword,
    activeScene,
    setActiveScene,
    lastSfx,
    setLastSfx,
    scoreboard,
    setScoreboard,
    overlayAudioKey,
    overlayAudioKeyPending,
  } = useStreamObsPersistedForm(userEmail, normalizedEmail);

  const cueOverlaySfxByProfile = useMutation(api.streamObsProfiles.cueOverlaySfxByProfile);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const overlaySfxListenUrl =
    overlayAudioKey && origin ? `${origin}/overlay/sfx?k=${encodeURIComponent(overlayAudioKey)}` : null;
  const scoreboardOverlayUrl =
    overlayAudioKey && origin
      ? `${origin}/overlay/scoreboard?k=${encodeURIComponent(overlayAudioKey)}`
      : null;

  const [scoreboardBrowserSourceName, setScoreboardBrowserSourceName] = useState("EOSLT Scoreboard");
  const [wireScoreboardPending, setWireScoreboardPending] = useState(false);
  const [wireScoreboardError, setWireScoreboardError] = useState<string | null>(null);
  const [wireScoreboardSuccessAt, setWireScoreboardSuccessAt] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [obsServerInfo, setObsServerInfo] = useState<string | null>(null);
  const [obsCredentials, setObsCredentials] = useState<ObsCredentials | null>(null);

  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
    toggleSource,
    togglingKey,
  } = useObsProgramSources(obsCredentials, connected);

  const {
    channels: obsAudioChannels,
    loading: obsAudioLoading,
    error: obsAudioError,
    refetch: refetchObsAudio,
    setVolume: setObsInputVolume,
    setMute: setObsInputMute,
  } = useObsAudioInputs(obsCredentials, connected);

  const wireScoreboardToObs = useCallback(async () => {
    if (!obsCredentials || !overlayAudioKey || !origin) {
      setWireScoreboardError("Overlay URL or OBS connection is not ready yet.");
      return;
    }
    setWireScoreboardPending(true);
    setWireScoreboardError(null);
    try {
      await saveProfileNow();
      const url = `${origin}/overlay/scoreboard?k=${encodeURIComponent(overlayAudioKey)}`;
      const res = await fetch("/api/stream/obs/set-browser-source-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          host: obsCredentials.host,
          port: obsCredentials.port,
          password: obsCredentials.password,
          inputName: scoreboardBrowserSourceName.trim() || "EOSLT Scoreboard",
          url,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setWireScoreboardSuccessAt(null);
        setWireScoreboardError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setWireScoreboardError(null);
      setWireScoreboardSuccessAt(new Date().toLocaleTimeString());
    } catch {
      setWireScoreboardSuccessAt(null);
      setWireScoreboardError("Network error — could not reach OBS.");
    } finally {
      setWireScoreboardPending(false);
    }
  }, [obsCredentials, overlayAudioKey, origin, saveProfileNow, scoreboardBrowserSourceName]);

  const handleConnect = useCallback(async (h: string, p: string, pw: string) => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const res = await fetch("/api/stream/obs/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ host: h.trim(), port: p.trim(), password: pw }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        obsVersion?: string;
        obsWebSocketVersion?: number;
        platform?: string;
      };
      if (!res.ok || !data.ok) {
        setConnected(false);
        setObsServerInfo(null);
        setObsCredentials(null);
        setConnectError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const bits = [
        data.obsVersion && `OBS ${data.obsVersion}`,
        data.obsWebSocketVersion != null && `WebSocket v${data.obsWebSocketVersion}`,
        data.platform,
      ].filter(Boolean);
      setObsServerInfo(bits.join(" · "));
      setObsCredentials({ host: h.trim(), port: p, password: pw });
      setConnected(true);
      void saveProfileNow();
    } catch {
      setConnected(false);
      setObsServerInfo(null);
      setObsCredentials(null);
      setConnectError("Network Error — Is The App Running And Are You Signed In?");
    } finally {
      setIsConnecting(false);
    }
  }, [saveProfileNow]);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setObsServerInfo(null);
    setObsCredentials(null);
    setConnectError(null);
  }, []);

  const triggerSfx = useCallback(
    async (soundId: string) => {
      setLastSfx(formatStreamSfxButtonLabel(soundId));
      const name = connectionName.trim();
      if (!name) return;
      await saveProfileNow();
      await cueOverlaySfxByProfile({
        email: normalizedEmail,
        connectionName: name,
        soundId,
      });
    },
    [normalizedEmail, connectionName, cueOverlaySfxByProfile, saveProfileNow, setLastSfx]
  );

  return (
    <ObsStreamCardOpenProvider email={normalizedEmail}>
      <div className="min-h-[calc(100vh-3.5rem)] w-full bg-black px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-6xl">
          <StreamObsPageHeader connected={connected} userEmail={userEmail} userName={userName} />

          <ObsConnectionPanel
            connected={connected}
            isConnecting={isConnecting}
            connectError={connectError}
            serverInfo={obsServerInfo}
            connectionName={connectionName}
            onConnectionNameChange={setConnectionName}
            savedConnectionNames={savedConnectionNames}
            host={host}
            onHostChange={setHost}
            port={port}
            onPortChange={setPort}
            password={password}
            onPasswordChange={setPassword}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />

          {connected && obsCredentials ? (
            <StreamObsConnectedPanels
              connectionName={connectionName}
              soundboardEffects={soundboardEffects}
              obsCredentials={obsCredentials}
              activeScene={activeScene}
              setActiveScene={setActiveScene}
              lastSfx={lastSfx}
              onTriggerSfx={triggerSfx}
              overlaySfxListenUrl={overlaySfxListenUrl}
              overlaySfxKeyPending={overlayAudioKeyPending}
              sources={sources}
              onToggleSource={toggleSource}
              sourcesLoading={sourcesLoading}
              sourcesError={sourcesError}
              onRefreshSources={refetchSources}
              togglingKey={togglingKey}
              audioChannels={obsAudioChannels}
              audioLoading={obsAudioLoading}
              audioError={obsAudioError}
              onRefreshAudio={refetchObsAudio}
              onAudioVolumeChange={setObsInputVolume}
              onAudioMute={setObsInputMute}
              scoreboard={scoreboard}
              onScoreboardChange={setScoreboard}
              scoreboardOverlayUrl={scoreboardOverlayUrl}
              overlayKeyPending={overlayAudioKeyPending}
              scoreboardBrowserSourceName={scoreboardBrowserSourceName}
              onScoreboardBrowserSourceNameChange={setScoreboardBrowserSourceName}
              onWireScoreboardToObs={wireScoreboardToObs}
              wireScoreboardPending={wireScoreboardPending}
              wireScoreboardError={wireScoreboardError}
              wireScoreboardSuccessAt={wireScoreboardSuccessAt}
            />
          ) : null}
        </div>
      </div>
    </ObsStreamCardOpenProvider>
  );
}
