"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  RESULTS_PREVIEW_CARD_OUTER_HEIGHT_PX,
  RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX,
  readResultsPreviewOuterDimensionsPx,
} from "@/lib/streamObsResultsPreviewDimensions";
import {
  SCOREBOARD_PREVIEW_CARD_OUTER_HEIGHT_PX,
  SCOREBOARD_PREVIEW_CARD_OUTER_WIDTH_PX,
} from "@/lib/streamObsScoreboardPreviewDimensions";
import {
  SFX_BROWSER_SOURCE_HEIGHT_PX,
  SFX_BROWSER_SOURCE_INITIAL_VOLUME_DB,
  SFX_BROWSER_SOURCE_WIDTH_PX,
} from "@/lib/streamObsSfxBrowserDimensions";
import { formatStreamSfxButtonLabel } from "@/lib/stream-sfx-basename";
import {
  DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
  DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
  DEFAULT_SFX_BROWSER_SOURCE_NAME,
} from "@/components/stream/streamObsFormDefaults";
import { useObsScenes } from "@/components/stream/useObsScenes";
import { fetchObsPanelsSnapshot } from "@/lib/stream-obs-fetch-panels-snapshot";
import { obsClientConnect, obsClientSetBrowserSourceUrl } from "@/lib/stream-obs-client-actions";

type StreamObsDashboardProps = {
  userEmail: string;
  userName: string | null;
  /** Basenames of `public/stream-sfx/*.mp3` discovered at request time. */
  sfxBasenames: string[];
  /**
   * When set (`NEXT_PUBLIC_STREAM_OVERLAY_ORIGIN`), overlay URLs use this instead of server/client origins.
   */
  overlayPublicOrigin?: string | null;
  /**
   * Next.js server origin for this request (from Host + LAN IPv4 when Host is loopback).
   * Used for Export / copied overlay URLs so the OBS PC loads this machine, not localhost.
   */
  overlayRequestOrigin?: string | null;
};

/**
 * Stream OBS dashboard: on Vercel, OBS WebSocket runs in the browser (see `lib/stream-obs-transport.ts`);
 * locally, API routes are used by default.
 * Named connection profiles persist to Convex when Connection name is set.
 */
export function StreamObsDashboard({
  userEmail,
  userName,
  sfxBasenames,
  overlayPublicOrigin,
  overlayRequestOrigin,
}: StreamObsDashboardProps) {
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
    setLastSfx,
    scoreboard,
    setScoreboard,
    tournamentSettings,
    setTournamentSettings,
    scoreboardBrowserSourceName,
    setScoreboardBrowserSourceName,
    sfxBrowserSourceName,
    setSfxBrowserSourceName,
    resultsBrowserSourceName,
    setResultsBrowserSourceName,
    overlayAudioKey,
    overlayAudioKeyPending,
    streamLogos,
  } = useStreamObsPersistedForm(userEmail, normalizedEmail);

  const cueOverlaySfxByProfile = useMutation(api.streamObsProfiles.cueOverlaySfxByProfile);
  const envOrigin = (overlayPublicOrigin ?? "").trim();
  const requestOrigin = (overlayRequestOrigin ?? "").trim();
  const [clientOrigin, setClientOrigin] = useState("");
  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);

  /** Env wins; then server-derived (LAN IP when dashboard was opened via localhost); then tab origin. */
  const publicOrigin = envOrigin || requestOrigin || clientOrigin;

  const overlaySfxListenUrl =
    overlayAudioKey && publicOrigin
      ? `${publicOrigin}/overlay/sfx?k=${encodeURIComponent(overlayAudioKey)}`
      : null;
  const scoreboardOverlayUrl =
    overlayAudioKey && publicOrigin
      ? `${publicOrigin}/overlay/scoreboard?k=${encodeURIComponent(overlayAudioKey)}`
      : null;
  const resultsOverlayUrl =
    overlayAudioKey && publicOrigin
      ? `${publicOrigin}/overlay/results?k=${encodeURIComponent(overlayAudioKey)}`
      : null;

  const [wireScoreboardPending, setWireScoreboardPending] = useState(false);
  const [wireScoreboardError, setWireScoreboardError] = useState<string | null>(null);
  const [wireResultsPending, setWireResultsPending] = useState(false);
  const [wireResultsError, setWireResultsError] = useState<string | null>(null);

  const [wireSfxPending, setWireSfxPending] = useState(false);
  const [wireSfxError, setWireSfxError] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [obsServerInfo, setObsServerInfo] = useState<string | null>(null);
  const [obsCredentials, setObsCredentials] = useState<ObsCredentials | null>(null);

  const refetchPanelsRef = useRef<() => Promise<void>>(async () => {});
  const triggerBatchedPanelsRefetch = useCallback(async () => {
    await refetchPanelsRef.current();
  }, []);

  const {
    scenes,
    loading: scenesLoading,
    error: scenesError,
    notifyPanelsRefetchStart: scenesRefetchStart,
    ingestPanelsSnapshot: ingestScenesPanels,
    ingestPanelsRefetchError: ingestScenesError,
    selectScene,
    switchingScene,
  } = useObsScenes(obsCredentials, connected, setActiveScene);

  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
    notifyPanelsRefetchStart: sourcesRefetchStart,
    ingestPanelsSnapshot: ingestSourcesPanels,
    ingestPanelsRefetchError: ingestSourcesError,
    toggleSource,
    togglingKey,
  } = useObsProgramSources(obsCredentials, connected);

  const {
    channels: obsAudioChannels,
    loading: obsAudioLoading,
    error: obsAudioError,
    notifyPanelsRefetchStart: audioRefetchStart,
    ingestPanelsSnapshot: ingestAudioPanels,
    ingestPanelsRefetchError: ingestAudioError,
    setVolume: setObsInputVolume,
    setMute: setObsInputMute,
  } = useObsAudioInputs(obsCredentials, connected, triggerBatchedPanelsRefetch);

  const refetchAllObsPanels = useCallback(async () => {
    if (!obsCredentials) return;
    scenesRefetchStart();
    sourcesRefetchStart();
    audioRefetchStart();
    const result = await fetchObsPanelsSnapshot(obsCredentials);
    if (!result.ok) {
      const msg = result.error;
      ingestScenesError(msg);
      ingestSourcesError(msg);
      ingestAudioError(msg);
      return;
    }
    ingestScenesPanels({
      scenes: result.scenes,
      currentProgramSceneName: result.currentProgramSceneName,
    });
    ingestSourcesPanels({ items: result.items });
    ingestAudioPanels({ inputs: result.inputs });
  }, [
    obsCredentials,
    scenesRefetchStart,
    sourcesRefetchStart,
    audioRefetchStart,
    ingestScenesError,
    ingestSourcesError,
    ingestAudioError,
    ingestScenesPanels,
    ingestSourcesPanels,
    ingestAudioPanels,
  ]);

  useEffect(() => {
    refetchPanelsRef.current = refetchAllObsPanels;
  }, [refetchAllObsPanels]);

  useEffect(() => {
    if (!connected || !obsCredentials) return;
    void refetchAllObsPanels();
  }, [connected, obsCredentials, refetchAllObsPanels]);

  const wireScoreboardToObs = useCallback(async () => {
    if (!obsCredentials || !overlayAudioKey || !publicOrigin) {
      setWireScoreboardError("Overlay URL or OBS connection is not ready yet.");
      return;
    }
    setWireScoreboardPending(true);
    setWireScoreboardError(null);
    try {
      await saveProfileNow();
      const url = `${publicOrigin}/overlay/scoreboard?k=${encodeURIComponent(overlayAudioKey)}`;
      const data = await obsClientSetBrowserSourceUrl(
        obsCredentials,
        scoreboardBrowserSourceName.trim() || DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
        url,
        {
          pixelSize: {
            width: SCOREBOARD_PREVIEW_CARD_OUTER_WIDTH_PX,
            height: SCOREBOARD_PREVIEW_CARD_OUTER_HEIGHT_PX,
          },
        }
      );
      if (!data.ok) {
        setWireScoreboardError(data.error ?? "Could not update OBS browser source.");
        return;
      }
      setWireScoreboardError(null);
    } catch {
      setWireScoreboardError("Network error — could not reach OBS.");
    } finally {
      setWireScoreboardPending(false);
    }
  }, [obsCredentials, overlayAudioKey, publicOrigin, saveProfileNow, scoreboardBrowserSourceName]);

  const wireResultsToObs = useCallback(async () => {
    if (!obsCredentials || !overlayAudioKey || !publicOrigin) {
      setWireResultsError("Overlay URL or OBS connection is not ready yet.");
      return;
    }
    setWireResultsPending(true);
    setWireResultsError(null);
    try {
      await saveProfileNow();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const measured = readResultsPreviewOuterDimensionsPx(resultsPreviewOuterRef.current);
      let width = RESULTS_PREVIEW_CARD_OUTER_WIDTH_PX;
      let height = RESULTS_PREVIEW_CARD_OUTER_HEIGHT_PX;
      if (measured.ok) {
        width = measured.width;
        height = measured.height;
      } else if (measured.reason === "missing") {
        setWireResultsError(
          "Connect to OBS and keep the Scoreboard Overlay section on this page mounted, then export again."
        );
        return;
      } else {
        setWireResultsError(
          "Expand the Scoreboard Overlay card so the results preview is fully visible, then export again."
        );
        return;
      }
      const url = `${publicOrigin}/overlay/results?k=${encodeURIComponent(overlayAudioKey)}`;
      const data = await obsClientSetBrowserSourceUrl(
        obsCredentials,
        resultsBrowserSourceName.trim() || DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
        url,
        { pixelSize: { width, height } }
      );
      if (!data.ok) {
        setWireResultsError(data.error ?? "Could not update OBS browser source.");
        return;
      }
      setWireResultsError(null);
    } catch {
      setWireResultsError("Network error — could not reach OBS.");
    } finally {
      setWireResultsPending(false);
    }
  }, [obsCredentials, overlayAudioKey, publicOrigin, saveProfileNow, resultsBrowserSourceName]);

  const wireSfxToObs = useCallback(async () => {
    if (!obsCredentials || !overlayAudioKey || !publicOrigin) {
      setWireSfxError("Overlay URL or OBS connection is not ready yet.");
      return;
    }
    setWireSfxPending(true);
    setWireSfxError(null);
    try {
      await saveProfileNow();
      const url = `${publicOrigin}/overlay/sfx?k=${encodeURIComponent(overlayAudioKey)}`;
      const data = await obsClientSetBrowserSourceUrl(
        obsCredentials,
        sfxBrowserSourceName.trim() || DEFAULT_SFX_BROWSER_SOURCE_NAME,
        url,
        {
          pixelSize: {
            width: SFX_BROWSER_SOURCE_WIDTH_PX,
            height: SFX_BROWSER_SOURCE_HEIGHT_PX,
          },
          rerouteAudio: true,
          audioMonitorAndOutput: true,
          initialInputVolumeDb: SFX_BROWSER_SOURCE_INITIAL_VOLUME_DB,
        }
      );
      if (!data.ok) {
        setWireSfxError(data.error ?? "Could not update OBS browser source.");
        return;
      }
      setWireSfxError(null);
    } catch {
      setWireSfxError("Network error — could not reach OBS.");
    } finally {
      setWireSfxPending(false);
    }
  }, [obsCredentials, overlayAudioKey, publicOrigin, saveProfileNow, sfxBrowserSourceName]);

  const handleConnect = useCallback(async (h: string, p: string, pw: string) => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const data = await obsClientConnect({
        host: h.trim(),
        port: p.trim(),
        password: pw,
      });
      if (!data.ok) {
        setConnected(false);
        setObsServerInfo(null);
        setObsCredentials(null);
        setConnectError(data.error ?? "Could not connect to OBS.");
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
      void saveProfileNow(true);
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

  /** Border box of the stream page results preview; drives OBS browser source width/height on export. */
  const resultsPreviewOuterRef = useRef<HTMLDivElement | null>(null);

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
            overlaySfxListenUrl={overlaySfxListenUrl}
            overlaySfxKeyPending={overlayAudioKeyPending}
            sfxBrowserSourceName={sfxBrowserSourceName}
            onSfxBrowserSourceNameChange={setSfxBrowserSourceName}
            onWireSfxToObs={wireSfxToObs}
            wireSfxPending={wireSfxPending}
            wireSfxError={wireSfxError}
            scoreboardOverlayUrl={scoreboardOverlayUrl}
            scoreboardOverlayKeyPending={overlayAudioKeyPending}
            scoreboardBrowserSourceName={scoreboardBrowserSourceName}
            onScoreboardBrowserSourceNameChange={setScoreboardBrowserSourceName}
            onWireScoreboardToObs={wireScoreboardToObs}
            wireScoreboardPending={wireScoreboardPending}
            wireScoreboardError={wireScoreboardError}
            resultsOverlayUrl={resultsOverlayUrl}
            resultsOverlayKeyPending={overlayAudioKeyPending}
            resultsBrowserSourceName={resultsBrowserSourceName}
            onResultsBrowserSourceNameChange={setResultsBrowserSourceName}
            onWireResultsToObs={wireResultsToObs}
            wireResultsPending={wireResultsPending}
            wireResultsError={wireResultsError}
            emailNormalized={normalizedEmail}
            streamLogos={streamLogos}
            obsCredentials={obsCredentials}
            onSaveStreamProfile={saveProfileNow}
          />

          {connected && obsCredentials ? (
            <StreamObsConnectedPanels
              connectionName={connectionName}
              soundboardEffects={soundboardEffects}
              obsCredentials={obsCredentials}
              resultsPreviewOuterRef={resultsPreviewOuterRef}
              activeScene={activeScene}
              scenes={scenes}
              scenesLoading={scenesLoading}
              scenesError={scenesError}
              onSelectScene={(name) => void selectScene(name)}
              switchingScene={switchingScene}
              onTriggerSfx={triggerSfx}
              sources={sources}
              onToggleSource={toggleSource}
              sourcesLoading={sourcesLoading}
              sourcesError={sourcesError}
              onRefreshObsPanels={() => void refetchAllObsPanels()}
              togglingKey={togglingKey}
              audioChannels={obsAudioChannels}
              audioLoading={obsAudioLoading}
              audioError={obsAudioError}
              onAudioVolumeChange={setObsInputVolume}
              onAudioMute={setObsInputMute}
              scoreboard={scoreboard}
              onScoreboardChange={setScoreboard}
              tournamentSettings={tournamentSettings}
              onTournamentSettingsChange={setTournamentSettings}
              onTournamentPersistRequest={() => void saveProfileNow()}
            />
          ) : null}
        </div>
      </div>
    </ObsStreamCardOpenProvider>
  );
}
