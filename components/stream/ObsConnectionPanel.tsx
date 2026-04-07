"use client";

import { useLayoutEffect, useRef } from "react";
import { ObsCollapsibleCard } from "@/components/stream/ObsCollapsibleCard";
import { labelTitleCase } from "@/lib/labelTitleCase";
import { ObsConnectionNameCombobox } from "@/components/stream/ObsConnectionNameCombobox";
import { ObsConnectionLogosSection } from "@/components/stream/ObsConnectionLogosSection";
import { ObsConnectionOverlayUrlsSection } from "@/components/stream/ObsConnectionOverlayUrlsSection";
import type { StreamLogoRowUi } from "@/components/stream/streamObsLogoTypes";
import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";
import { useObsStreamCardOpen } from "@/components/stream/ObsStreamCardOpenContext";

type ObsConnectionPanelProps = {
  connected: boolean;
  isConnecting: boolean;
  connectError: string | null;
  serverInfo: string | null;
  connectionName: string;
  onConnectionNameChange: (value: string) => void;
  savedConnectionNames: string[];
  host: string;
  onHostChange: (value: string) => void;
  port: string;
  onPortChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onConnect: (host: string, port: string, password: string) => void | Promise<void>;
  onDisconnect: () => void;
  overlaySfxListenUrl: string | null;
  overlaySfxKeyPending: boolean;
  sfxBrowserSourceName: string;
  onSfxBrowserSourceNameChange: (name: string) => void;
  onWireSfxToObs: () => void | Promise<void>;
  wireSfxPending: boolean;
  wireSfxError: string | null;
  videoPlayerSceneName: string;
  onVideoPlayerSceneNameChange: (name: string) => void;
  onWireVideoPlayerScene: () => void | Promise<void>;
  wireVideoPlayerScenePending: boolean;
  wireVideoPlayerSceneError: string | null;
  scoreboardOverlayUrl: string | null;
  scoreboardOverlayKeyPending: boolean;
  scoreboardBrowserSourceName: string;
  onScoreboardBrowserSourceNameChange: (name: string) => void;
  onWireScoreboardToObs: () => void | Promise<void>;
  wireScoreboardPending: boolean;
  wireScoreboardError: string | null;
  resultsOverlayUrl: string | null;
  resultsOverlayKeyPending: boolean;
  resultsBrowserSourceName: string;
  onResultsBrowserSourceNameChange: (name: string) => void;
  onWireResultsToObs: () => void | Promise<void>;
  wireResultsPending: boolean;
  wireResultsError: string | null;
  emailNormalized: string;
  streamLogos: StreamLogoRowUi[];
  obsCredentials: ObsCredentials | null;
  onSaveStreamProfile: () => Promise<void>;
};

/**
 * OBS WebSocket connection: Connect calls the server API, which opens a real WebSocket to OBS.
 */
export function ObsConnectionPanel({
  connected,
  isConnecting,
  connectError,
  serverInfo,
  connectionName,
  onConnectionNameChange,
  savedConnectionNames,
  host,
  onHostChange,
  port,
  onPortChange,
  password,
  onPasswordChange,
  onConnect,
  onDisconnect,
  overlaySfxListenUrl,
  overlaySfxKeyPending,
  sfxBrowserSourceName,
  onSfxBrowserSourceNameChange,
  onWireSfxToObs,
  wireSfxPending,
  wireSfxError,
  videoPlayerSceneName,
  onVideoPlayerSceneNameChange,
  onWireVideoPlayerScene,
  wireVideoPlayerScenePending,
  wireVideoPlayerSceneError,
  scoreboardOverlayUrl,
  scoreboardOverlayKeyPending,
  scoreboardBrowserSourceName,
  onScoreboardBrowserSourceNameChange,
  onWireScoreboardToObs,
  wireScoreboardPending,
  wireScoreboardError,
  resultsOverlayUrl,
  resultsOverlayKeyPending,
  resultsBrowserSourceName,
  onResultsBrowserSourceNameChange,
  onWireResultsToObs,
  wireResultsPending,
  wireResultsError,
  emailNormalized,
  streamLogos,
  obsCredentials,
  onSaveStreamProfile,
}: ObsConnectionPanelProps) {
  const { open: cardOpen, setOpen: setCardOpen } = useObsStreamCardOpen(STREAM_OBS_CARD_IDS.connection);
  const wasConnectedRef = useRef(false);

  /** Collapse once when a connection succeeds — not on every render while connected (would block re-opening). */
  useLayoutEffect(() => {
    if (connected && !wasConnectedRef.current) {
      setCardOpen(false);
    }
    wasConnectedRef.current = connected;
  }, [connected, setCardOpen]);

  const glowClass = connected
    ? "border-green-400/70 shadow-[0_0_28px_rgba(74,222,128,0.65),0_0_56px_rgba(34,197,94,0.35)] ring-2 ring-green-400/80 ring-offset-2 ring-offset-black transition-[box-shadow,border-color,ring] duration-300"
    : "transition-[box-shadow,border-color,ring] duration-300";

  return (
    <ObsCollapsibleCard
      title="OBS Connection"
      collapseLabel="OBS Connection"
      className={glowClass}
      open={cardOpen}
      onOpenChange={setCardOpen}
      headerExtra={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            connected
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
              : "bg-red-500/20 text-red-300 ring-1 ring-red-500/45"
          }`}
          role="status"
        >
          {connected ? "Connected" : "Not Connected"}
        </span>
      }
    >
      {connected && serverInfo && (
        <p className="text-xs text-slate-500">{serverInfo}</p>
      )}
      <div className="flex flex-col gap-3">
        <ObsConnectionNameCombobox
          value={connectionName}
          onChange={onConnectionNameChange}
          savedNames={savedConnectionNames}
          disabled={connected}
        />
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4 lg:flex-nowrap">
          <label className="flex min-w-0 flex-1 flex-col text-xs font-medium text-slate-400">
            {labelTitleCase("host")}
            <input
              type="text"
              value={host}
              onChange={(e) => onHostChange(e.target.value)}
              disabled={connected}
              autoComplete="off"
              className="mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40 disabled:opacity-60"
            />
          </label>
          <label className="flex w-full flex-col text-xs font-medium text-slate-400 md:w-[6.5rem] md:shrink-0 lg:w-28">
            {labelTitleCase("port")}
            <input
              type="text"
              inputMode="numeric"
              value={port}
              onChange={(e) => onPortChange(e.target.value)}
              disabled={connected}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40 disabled:opacity-60"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col text-xs font-medium text-slate-400">
            WebSocket Password
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              disabled={connected}
              autoComplete="off"
              className="mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40 disabled:opacity-60"
            />
          </label>
        </div>
        <ObsConnectionOverlayUrlsSection
          connected={connected}
          overlaySfxListenUrl={overlaySfxListenUrl}
          overlaySfxKeyPending={overlaySfxKeyPending}
          sfxBrowserSourceName={sfxBrowserSourceName}
          onSfxBrowserSourceNameChange={onSfxBrowserSourceNameChange}
          onWireSfxToObs={onWireSfxToObs}
          wireSfxPending={wireSfxPending}
          wireSfxError={wireSfxError}
          videoPlayerSceneName={videoPlayerSceneName}
          onVideoPlayerSceneNameChange={onVideoPlayerSceneNameChange}
          onWireVideoPlayerScene={onWireVideoPlayerScene}
          wireVideoPlayerScenePending={wireVideoPlayerScenePending}
          wireVideoPlayerSceneError={wireVideoPlayerSceneError}
          scoreboardOverlayUrl={scoreboardOverlayUrl}
          scoreboardOverlayKeyPending={scoreboardOverlayKeyPending}
          scoreboardBrowserSourceName={scoreboardBrowserSourceName}
          onScoreboardBrowserSourceNameChange={onScoreboardBrowserSourceNameChange}
          onWireScoreboardToObs={onWireScoreboardToObs}
          wireScoreboardPending={wireScoreboardPending}
          wireScoreboardError={wireScoreboardError}
          resultsOverlayUrl={resultsOverlayUrl}
          resultsOverlayKeyPending={resultsOverlayKeyPending}
          resultsBrowserSourceName={resultsBrowserSourceName}
          onResultsBrowserSourceNameChange={onResultsBrowserSourceNameChange}
          onWireResultsToObs={onWireResultsToObs}
          wireResultsPending={wireResultsPending}
          wireResultsError={wireResultsError}
        />
        <ObsConnectionLogosSection
          emailNormalized={emailNormalized}
          connectionName={connectionName}
          connected={connected}
          obsCredentials={obsCredentials}
          logos={streamLogos}
          onSaveProfile={onSaveStreamProfile}
        />
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
        {connectError ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
            {connectError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {!connected ? (
            <button
              type="button"
              disabled={isConnecting || !connectionName.trim()}
              title={
                !connectionName.trim()
                  ? "Enter A Connection Name Above To Enable Connect"
                  : undefined
              }
              onClick={() => void onConnect(host, port, password)}
              className="rounded-lg bg-gradient-to-r from-sky-600 to-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-900/30 transition hover:from-sky-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-sky-400/55 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isConnecting ? "Connecting…" : "Connect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-red-400/70 bg-transparent px-4 py-2.5 text-sm font-semibold text-red-300 shadow-sm transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/45"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </ObsCollapsibleCard>
  );
}
