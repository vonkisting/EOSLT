"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ObsConnectionPanel } from "@/components/stream/ObsConnectionPanel";
import { ObsStreamCardOpenProvider } from "@/components/stream/ObsStreamCardOpenContext";
import { StreamObsLayoutProvider } from "@/components/stream/StreamObsLayoutContext";
import { StreamObsConnectedPanels } from "@/components/stream/StreamObsConnectedPanels";
import { useObsAudioInputs } from "@/components/stream/useObsAudioInputs";
import {
  type ObsCredentials,
  useObsProgramSources,
} from "@/components/stream/useObsProgramSources";
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
  DEFAULT_VIDEO_PLAYER_SCENE_NAME,
} from "@/components/stream/streamObsFormDefaults";
import { useObsScenes } from "@/components/stream/useObsScenes";
import { fetchObsPanelsSnapshot } from "@/lib/stream-obs-fetch-panels-snapshot";
import {
  applyPersistedAudioToObs,
  applyPersistedSourcesToObs,
} from "@/lib/streamObsApplyPersistedPanels";
import {
  mergeObsAudioInputsWithPersist,
  mergeObsSceneItemsWithPersist,
  parseAudioChannelsPersistJson,
  parseProgramSourcesPersistJson,
  serializeAudioChannelsForPersist,
  serializeProgramSourcesForPersist,
} from "@/lib/streamObsPanelsPersist";
import {
  obsClientConnect,
  obsClientEnsureGraphicsScene,
  obsClientSetBrowserSourceUrl,
} from "@/lib/stream-obs-client-actions";

type StreamObsDashboardProps = {
  userEmail: string;
  /** SFX ids (filename without extension) under `public/stream-sfx/` at request time. */
  sfxBasenames: string[];
  /** Graphics video ids under `public/stream-graphics/` at request time. */
  graphicsBasenames: string[];
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
  sfxBasenames,
  graphicsBasenames,
  overlayPublicOrigin,
  overlayRequestOrigin,
}: StreamObsDashboardProps) {
  const router = useRouter();
  const normalizedEmail = userEmail.toLowerCase().trim();

  const soundboardEffects = useMemo(
    () =>
      sfxBasenames.map((id) => ({
        id,
        label: formatStreamSfxButtonLabel(id),
      })),
    [sfxBasenames]
  );

  const graphicsEffects = useMemo(
    () =>
      graphicsBasenames.map((id) => ({
        id,
        label: formatStreamSfxButtonLabel(id),
      })),
    [graphicsBasenames]
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
    videoPlayerSceneName,
    setVideoPlayerSceneName,
    resultsBrowserSourceName,
    setResultsBrowserSourceName,
    overlayAudioKey,
    overlayAudioKeyPending,
    streamLogos,
    streamObsProfile,
    syncPanelsPersistSnapshot,
  } = useStreamObsPersistedForm(userEmail, normalizedEmail);

  const streamObsProfileRef = useRef(streamObsProfile);
  useLayoutEffect(() => {
    streamObsProfileRef.current = streamObsProfile;
  }, [streamObsProfile]);

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

  const [wireVideoPlayerScenePending, setWireVideoPlayerScenePending] = useState(false);
  const [wireVideoPlayerSceneError, setWireVideoPlayerSceneError] = useState<string | null>(null);
  const [graphicsTriggerError, setGraphicsTriggerError] = useState<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [obsServerInfo, setObsServerInfo] = useState<string | null>(null);
  const [obsCredentials, setObsCredentials] = useState<ObsCredentials | null>(null);

  const appliedPersistedObsFromProfileRef = useRef(false);
  useEffect(() => {
    if (!connected) appliedPersistedObsFromProfileRef.current = false;
  }, [connected]);

  const trimmedStreamConnection = connectionName.trim();
  useEffect(() => {
    appliedPersistedObsFromProfileRef.current = false;
  }, [trimmedStreamConnection]);

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

    const prof = streamObsProfileRef.current;
    const persistAudio = prof?.audioChannelsJson ?? "";
    const persistSources =
      (prof as { programSourcesJson?: string | null } | null)?.programSourcesJson ?? "";

    const audioMap = parseAudioChannelsPersistJson(persistAudio);
    const sourcesMap = parseProgramSourcesPersistJson(
      typeof persistSources === "string" ? persistSources : ""
    );
    const mergedInputs = mergeObsAudioInputsWithPersist(result.inputs, audioMap);
    const mergedItems = mergeObsSceneItemsWithPersist(result.items, sourcesMap);

    const shouldPushPersist =
      !appliedPersistedObsFromProfileRef.current &&
      (persistAudio.trim().length > 0 || String(persistSources).trim().length > 0);
    if (shouldPushPersist) {
      appliedPersistedObsFromProfileRef.current = true;
      if (persistAudio.trim()) {
        await applyPersistedAudioToObs(obsCredentials, result.inputs, persistAudio);
      }
      if (String(persistSources).trim()) {
        await applyPersistedSourcesToObs(
          obsCredentials,
          result.items,
          typeof persistSources === "string" ? persistSources : ""
        );
      }
    }

    ingestScenesPanels({
      scenes: result.scenes,
      currentProgramSceneName: result.currentProgramSceneName,
    });
    ingestSourcesPanels({ items: mergedItems });
    ingestAudioPanels({ inputs: mergedInputs });

    const want = prof?.activeScene?.trim() ?? "";
    const obsCur = result.currentProgramSceneName?.trim() ?? "";
    if (want && result.scenes.includes(want) && want !== obsCur) {
      await selectScene(want);
    }
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
    selectScene,
  ]);

  useEffect(() => {
    refetchPanelsRef.current = refetchAllObsPanels;
  }, [refetchAllObsPanels]);

  useEffect(() => {
    if (!connected || !obsCredentials) return;
    void refetchAllObsPanels();
  }, [connected, obsCredentials, refetchAllObsPanels]);

  useEffect(() => {
    if (!connected || !obsCredentials || obsAudioLoading || sourcesLoading) return;
    syncPanelsPersistSnapshot(
      serializeAudioChannelsForPersist(
        obsAudioChannels.map((c) => ({
          inputName: c.id,
          volume: c.volume,
          muted: c.muted,
        }))
      ),
      serializeProgramSourcesForPersist(
        sources.map((s) => ({
          sceneName: s.sceneName,
          sceneItemId: s.sceneItemId,
          visible: s.visible,
        }))
      )
    );
  }, [
    connected,
    obsCredentials,
    obsAudioLoading,
    sourcesLoading,
    obsAudioChannels,
    sources,
    syncPanelsPersistSnapshot,
  ]);

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
          "Make sure the results preview is fully visible on the page, then export again."
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

  const wireVideoPlayerSceneToObs = useCallback(async () => {
    if (!obsCredentials) {
      setWireVideoPlayerSceneError("Connect to OBS first.");
      return;
    }
    const scene = videoPlayerSceneName.trim() || DEFAULT_VIDEO_PLAYER_SCENE_NAME;
    setWireVideoPlayerScenePending(true);
    setWireVideoPlayerSceneError(null);
    try {
      await saveProfileNow();
      const data = await obsClientEnsureGraphicsScene(obsCredentials, scene);
      if (!data.ok) {
        setWireVideoPlayerSceneError(data.error ?? "Could not create scene in OBS.");
        return;
      }
      setWireVideoPlayerSceneError(null);
    } catch {
      setWireVideoPlayerSceneError("Network error — could not reach OBS.");
    } finally {
      setWireVideoPlayerScenePending(false);
    }
  }, [obsCredentials, saveProfileNow, videoPlayerSceneName]);

  const triggerGraphics = useCallback(
    async (graphicId: string) => {
      setGraphicsTriggerError(null);
      if (!obsCredentials || !publicOrigin) {
        setGraphicsTriggerError("Connect to OBS and ensure the stream URL origin is available.");
        return;
      }
      try {
        await saveProfileNow();
        const sceneLabel = formatStreamSfxButtonLabel(graphicId);
        const videoUrl = `${publicOrigin}/api/stream/graphics/play?graphicId=${encodeURIComponent(graphicId)}`;
        const data = await obsClientEnsureGraphicsScene(obsCredentials, sceneLabel, videoUrl);
        if (!data.ok) {
          setGraphicsTriggerError(data.error ?? "Could not update OBS.");
          return;
        }
      } catch {
        setGraphicsTriggerError("Network error — could not reach OBS.");
      }
    },
    [obsCredentials, publicOrigin, saveProfileNow]
  );

  /** Border box of the stream page results preview; drives OBS browser source width/height on export. */
  const resultsPreviewOuterRef = useRef<HTMLDivElement | null>(null);

  return (
    <ObsStreamCardOpenProvider email={normalizedEmail}>
      <div className="min-h-[calc(100vh-3.5rem)] w-full box-border bg-black px-4 py-6 md:px-6 md:py-8">
        <div className="w-full max-w-none">
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
            videoPlayerSceneName={videoPlayerSceneName}
            onVideoPlayerSceneNameChange={setVideoPlayerSceneName}
            onWireVideoPlayerScene={wireVideoPlayerSceneToObs}
            wireVideoPlayerScenePending={wireVideoPlayerScenePending}
            wireVideoPlayerSceneError={wireVideoPlayerSceneError}
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
            <StreamObsLayoutProvider email={normalizedEmail}>
              <StreamObsConnectedPanels
                connectionName={connectionName}
                soundboardEffects={soundboardEffects}
                graphicsEffects={graphicsEffects}
                graphicsObsReady={connected && Boolean(obsCredentials)}
                obsCredentials={obsCredentials}
                resultsPreviewOuterRef={resultsPreviewOuterRef}
                activeScene={activeScene}
                scenes={scenes}
                scenesLoading={scenesLoading}
                scenesError={scenesError}
                onSelectScene={(name) => void selectScene(name)}
                switchingScene={switchingScene}
                onTriggerSfx={triggerSfx}
                onSfxListRefresh={() => router.refresh()}
                onTriggerGraphics={triggerGraphics}
                onGraphicsListRefresh={() => router.refresh()}
                graphicsTriggerError={graphicsTriggerError}
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
            </StreamObsLayoutProvider>
          ) : null}
        </div>
      </div>
    </ObsStreamCardOpenProvider>
  );
}
