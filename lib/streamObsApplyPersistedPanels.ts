import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import {
  obsClientSetInputMute,
  obsClientSetInputVolume,
  obsClientSetSceneItemEnabled,
} from "@/lib/stream-obs-client-actions";
import {
  parseAudioChannelsPersistJson,
  parseProgramSourcesPersistJson,
} from "@/lib/streamObsPanelsPersist";

/**
 * Push saved mixer state to OBS when it differs from the snapshot (first load / refresh).
 */
export async function applyPersistedAudioToObs(
  credentials: ObsCredentials,
  obsInputs: Array<{ inputName: string; volume: number; muted: boolean }>,
  persistJson: string
): Promise<void> {
  const map = parseAudioChannelsPersistJson(persistJson);
  for (const row of obsInputs) {
    const p = map[row.inputName];
    if (!p) continue;
    const current = Math.round(Math.min(100, Math.max(0, row.volume)));
    if (current !== p.volume) {
      const vol = await obsClientSetInputVolume(credentials, row.inputName, p.volume);
      if (!vol.ok) return;
    }
    if (row.muted !== p.muted) {
      const m = await obsClientSetInputMute(credentials, row.inputName, p.muted);
      if (!m.ok) return;
    }
  }
}

/**
 * Push saved source visibility to OBS when it differs from the snapshot.
 */
export async function applyPersistedSourcesToObs(
  credentials: ObsCredentials,
  obsItems: Array<{
    sceneName: string;
    sceneItemId: number;
    sceneItemEnabled: boolean;
  }>,
  persistJson: string
): Promise<void> {
  const map = parseProgramSourcesPersistJson(persistJson);
  for (const it of obsItems) {
    const k = `${it.sceneName}\n${it.sceneItemId}`;
    if (!(k in map)) continue;
    const want = map[k];
    if (it.sceneItemEnabled === want) continue;
    const r = await obsClientSetSceneItemEnabled(credentials, {
      sceneName: it.sceneName,
      sceneItemId: it.sceneItemId,
      sceneItemEnabled: want,
    });
    if (!r.ok) return;
  }
}
