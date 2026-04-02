"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DEFAULT_SCOREBOARD,
  type ScoreboardState,
  DEFAULT_STREAM_OBS_HOST,
  DEFAULT_STREAM_OBS_PORT,
  parseScoreboardJson,
} from "@/components/stream/streamObsFormDefaults";
import {
  readLastStreamObsProfileName,
  writeLastStreamObsProfileName,
} from "@/lib/stream-obs-local-profile";

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

  const hydratingRef = useRef(false);
  const hydrateKeyRef = useRef("");

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
    if (profile === undefined || profile === null) return;
    const key = `${trimmedConnectionName}::${profile._id}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;
    hydratingRef.current = true;
    setHost(profile.host || DEFAULT_STREAM_OBS_HOST);
    setPort(profile.port || DEFAULT_STREAM_OBS_PORT);
    setPassword(profile.websocketPassword ?? "");
    setActiveScene(profile.activeScene ?? "Match");
    setScoreboard(parseScoreboardJson(profile.scoreboardJson));
    setLastSfx(profile.lastSfx ?? null);
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [profile, trimmedConnectionName]);

  const scoreboardJson = JSON.stringify(scoreboard);

  const profileReady = !trimmedConnectionName || profile !== undefined;

  useEffect(() => {
    if (!trimmedConnectionName || !profileReady) return;
    const t = setTimeout(() => {
      if (hydratingRef.current) return;
      void upsertProfile({
        email: normalizedEmail,
        connectionName: trimmedConnectionName,
        host,
        port,
        websocketPassword: password,
        activeScene: activeScene ?? undefined,
        scoreboardJson,
        lastSfx: lastSfx ?? undefined,
      });
      writeLastStreamObsProfileName(userEmail, trimmedConnectionName);
    }, 500);
    return () => clearTimeout(t);
  }, [
    trimmedConnectionName,
    profileReady,
    host,
    port,
    password,
    activeScene,
    scoreboardJson,
    lastSfx,
    normalizedEmail,
    userEmail,
    upsertProfile,
  ]);

  const saveProfileNow = useCallback(async () => {
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
      lastSfx: lastSfx ?? undefined,
    });
    writeLastStreamObsProfileName(userEmail, name);
  }, [
    connectionName,
    normalizedEmail,
    host,
    port,
    password,
    activeScene,
    scoreboard,
    lastSfx,
    userEmail,
    upsertProfile,
  ]);

  const overlayAudioKeyPending = Boolean(
    trimmedConnectionName &&
      (profile === undefined || profile === null || !profile.overlayAudioKey)
  );

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
  };
}
