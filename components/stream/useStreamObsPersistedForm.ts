"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_SCOREBOARD,
  DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
  DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
  DEFAULT_SFX_BROWSER_SOURCE_NAME,
  type ScoreboardState,
  DEFAULT_STREAM_OBS_HOST,
  DEFAULT_STREAM_OBS_PORT,
  parseScoreboardJson,
} from "@/components/stream/streamObsFormDefaults";
import {
  readLastStreamObsProfileName,
  writeLastStreamObsProfileName,
} from "@/lib/stream-obs-local-profile";
import type { StreamLogoRowUi } from "@/components/stream/streamObsLogoTypes";
import {
  DEFAULT_TOURNAMENT_SETTINGS,
  parseTournamentSettingsJson,
  tournamentSettingsToJson,
  type TournamentSettingsState,
} from "@/components/stream/tournamentSettingsDefaults";

/**
 * Connection profile fields persisted to Convex per connection name (when name is non-empty).
 */
export function useStreamObsPersistedForm(userEmail: string, normalizedEmail: string) {
  const [connectionName, setConnectionName] = useState("");
  const [didInitConnectionName, setDidInitConnectionName] = useState(false);
  const [host, setHost] = useState(DEFAULT_STREAM_OBS_HOST);
  const [port, setPort] = useState(DEFAULT_STREAM_OBS_PORT);
  const [password, setPassword] = useState("");
  const [activeScene, setActiveScene] = useState<string | null>("Match");
  const [lastSfx, setLastSfx] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardState>(DEFAULT_SCOREBOARD);
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettingsState>(
    DEFAULT_TOURNAMENT_SETTINGS
  );
  const [scoreboardBrowserSourceName, setScoreboardBrowserSourceName] = useState(
    DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME
  );
  const [sfxBrowserSourceName, setSfxBrowserSourceName] = useState(DEFAULT_SFX_BROWSER_SOURCE_NAME);
  const [resultsBrowserSourceName, setResultsBrowserSourceName] = useState(
    DEFAULT_RESULTS_BROWSER_SOURCE_NAME
  );

  const hydratingRef = useRef(false);
  const hydrateKeyRef = useRef("");
  const lastRemoteTournamentJsonRef = useRef<string | undefined>(undefined);
  const prevPlayerCountForSaveRef = useRef<number | null>(null);

  const profileRows = useQuery(api.streamObsProfiles.listByEmail, { email: normalizedEmail });
  const savedConnectionNames = profileRows?.map((r) => r.connectionName) ?? [];

  const trimmedConnectionName = connectionName.trim();
  const profile = useQuery(
    api.streamObsProfiles.get,
    trimmedConnectionName
      ? { email: normalizedEmail, connectionName: trimmedConnectionName }
      : "skip"
  );

  const upsertProfile = useMutation(api.streamObsProfiles.upsert);

  useEffect(() => {
    if (didInitConnectionName) return;
    const last = readLastStreamObsProfileName(userEmail);
    if (last) setConnectionName(last);
    setDidInitConnectionName(true);
  }, [userEmail, didInitConnectionName]);

  useEffect(() => {
    if (!trimmedConnectionName) hydrateKeyRef.current = "";
  }, [trimmedConnectionName]);

  useEffect(() => {
    prevPlayerCountForSaveRef.current = null;
    lastRemoteTournamentJsonRef.current = undefined;
  }, [trimmedConnectionName]);

  useEffect(() => {
    if (profile === undefined || profile === null) {
      lastRemoteTournamentJsonRef.current = undefined;
      prevPlayerCountForSaveRef.current = null;
      return;
    }
    const j = profile.tournamentSettingsJson ?? "";
    if (lastRemoteTournamentJsonRef.current === j) return;
    lastRemoteTournamentJsonRef.current = j;
    const parsed = parseTournamentSettingsJson(j || null);
    setTournamentSettings((prev) => {
      if (tournamentSettingsToJson(parsed) === tournamentSettingsToJson(prev)) {
        return prev;
      }
      prevPlayerCountForSaveRef.current = parsed.players.length;
      return parsed;
    });
  }, [profile, profile?.tournamentSettingsJson]);

  useEffect(() => {
    if (profile === undefined || profile === null) return;
    const key = `${trimmedConnectionName}::${profile._id}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;
    hydratingRef.current = true;
    setHost(profile.host || DEFAULT_STREAM_OBS_HOST);
    setPort(profile.port || DEFAULT_STREAM_OBS_PORT);
    setPassword(profile.websocketPassword ?? "");
    setActiveScene(profile.activeScene ?? "Match");
    const parsedScoreboard = parseScoreboardJson(profile.scoreboardJson);
    setScoreboard(parsedScoreboard);
    setScoreboardBrowserSourceName(
      profile.scoreboardBrowserSourceName?.trim() || DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME
    );
    setSfxBrowserSourceName(profile.sfxBrowserSourceName?.trim() || DEFAULT_SFX_BROWSER_SOURCE_NAME);
    setResultsBrowserSourceName(
      profile.resultsBrowserSourceName?.trim() || DEFAULT_RESULTS_BROWSER_SOURCE_NAME
    );
    setLastSfx(profile.lastSfx ?? null);
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [profile, trimmedConnectionName]);

  const scoreboardJson = JSON.stringify(scoreboard);
  const tournamentSettingsJson = tournamentSettingsToJson(tournamentSettings);

  /** Convex row exists for this connection name (not loading, not missing). */
  const hasPersistedProfile =
    Boolean(trimmedConnectionName) &&
    profile !== undefined &&
    profile !== null;

  /**
   * @param createIfMissing - Pass true after a successful OBS connect so the profile row is created.
   *                         Default false: only patch an existing row (never create from typing alone).
   */
  const saveProfileNow = useCallback(
    async (createIfMissing = false) => {
      const name = connectionName.trim();
      if (!name) return;
      await upsertProfile({
        email: normalizedEmail,
        connectionName: name,
        host,
        port,
        websocketPassword: password,
        activeScene: activeScene ?? undefined,
        scoreboardJson: JSON.stringify(scoreboard),
        tournamentSettingsJson,
        scoreboardBrowserSourceName:
          scoreboardBrowserSourceName.trim() || DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
        resultsBrowserSourceName:
          resultsBrowserSourceName.trim() || DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
        sfxBrowserSourceName: sfxBrowserSourceName.trim() || DEFAULT_SFX_BROWSER_SOURCE_NAME,
        lastSfx: lastSfx ?? undefined,
        createIfMissing,
      });
      if (createIfMissing || hasPersistedProfile) {
        writeLastStreamObsProfileName(userEmail, name);
      }
    },
    [
      connectionName,
      normalizedEmail,
      host,
      port,
      password,
      activeScene,
      scoreboard,
      tournamentSettings,
      tournamentSettingsJson,
      scoreboardBrowserSourceName,
      resultsBrowserSourceName,
      sfxBrowserSourceName,
      lastSfx,
      userEmail,
      upsertProfile,
      hasPersistedProfile,
    ]
  );

  /** Persist immediately when a tournament player row is added or removed (count change). */
  useEffect(() => {
    if (!hasPersistedProfile) return;
    const n = tournamentSettings.players.length;
    if (prevPlayerCountForSaveRef.current === null) {
      prevPlayerCountForSaveRef.current = n;
      return;
    }
    if (prevPlayerCountForSaveRef.current === n) return;
    prevPlayerCountForSaveRef.current = n;
    void saveProfileNow();
  }, [
    tournamentSettings.players.length,
    hasPersistedProfile,
    saveProfileNow,
  ]);

  /** Short debounce so OBS scoreboard overlay (Convex live query) tracks names. */
  useEffect(() => {
    if (!hasPersistedProfile) return;
    const t = setTimeout(() => {
      void upsertProfile({
        email: normalizedEmail,
        connectionName: trimmedConnectionName,
        host,
        port,
        websocketPassword: password,
        activeScene: activeScene ?? undefined,
        scoreboardJson,
        scoreboardBrowserSourceName:
          scoreboardBrowserSourceName.trim() || DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME,
        resultsBrowserSourceName:
          resultsBrowserSourceName.trim() || DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
        sfxBrowserSourceName: sfxBrowserSourceName.trim() || DEFAULT_SFX_BROWSER_SOURCE_NAME,
        lastSfx: lastSfx ?? undefined,
        createIfMissing: false,
      });
      writeLastStreamObsProfileName(userEmail, trimmedConnectionName);
    }, 120);
    return () => clearTimeout(t);
  }, [
    trimmedConnectionName,
    hasPersistedProfile,
    host,
    port,
    password,
    activeScene,
    scoreboardJson,
    lastSfx,
    scoreboardBrowserSourceName,
    resultsBrowserSourceName,
    sfxBrowserSourceName,
    normalizedEmail,
    userEmail,
    upsertProfile,
  ]);

  const overlayAudioKeyPending = Boolean(
    trimmedConnectionName &&
      (profile === undefined || profile === null || !profile.overlayAudioKey)
  );

  const streamLogos: StreamLogoRowUi[] = Array.isArray(
    (profile as { streamLogos?: unknown } | null | undefined)?.streamLogos
  )
    ? ((profile as { streamLogos: StreamLogoRowUi[] }).streamLogos)
    : [];

  return {
    connectionName,
    setConnectionName,
    saveProfileNow,
    savedConnectionNames,
    overlayAudioKey: profile?.overlayAudioKey ?? null,
    overlayAudioKeyPending,
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
    tournamentSettings,
    setTournamentSettings,
    scoreboardBrowserSourceName,
    setScoreboardBrowserSourceName,
    sfxBrowserSourceName,
    setSfxBrowserSourceName,
    resultsBrowserSourceName: resultsBrowserSourceName ?? DEFAULT_RESULTS_BROWSER_SOURCE_NAME,
    setResultsBrowserSourceName,
    streamLogos,
  };
}
