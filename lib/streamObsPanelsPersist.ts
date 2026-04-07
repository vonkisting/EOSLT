/**
 * Serialize / restore OBS panels (audio mixer + program scene sources) for stream dashboard Convex.
 */

export type AudioPersistEntry = { volume: number; muted: boolean };

export function parseAudioChannelsPersistJson(json: string | null | undefined): Record<string, AudioPersistEntry> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return {};
    const inputs = (o as { inputs?: unknown }).inputs;
    if (!Array.isArray(inputs)) return {};
    const out: Record<string, AudioPersistEntry> = {};
    for (const row of inputs) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const inputName = typeof r.inputName === "string" ? r.inputName : "";
      if (!inputName) continue;
      const volume =
        typeof r.volume === "number" && Number.isFinite(r.volume)
          ? Math.round(Math.min(100, Math.max(0, r.volume)))
          : 0;
      out[inputName] = { volume, muted: r.muted === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeAudioChannelsForPersist(
  inputs: Array<{ inputName: string; volume: number; muted: boolean }>
): string {
  return JSON.stringify({
    inputs: inputs.map((row) => ({
      inputName: row.inputName,
      volume: Math.round(Math.min(100, Math.max(0, row.volume))),
      muted: row.muted === true,
    })),
  });
}

export function mergeObsAudioInputsWithPersist<
  T extends { inputName: string; volume: number; muted: boolean },
>(obsInputs: T[], persist: Record<string, AudioPersistEntry>): T[] {
  return obsInputs.map((row) => {
    const p = persist[row.inputName];
    if (!p) return row;
    return { ...row, volume: p.volume, muted: p.muted };
  });
}

export function sourceTogglePersistKey(sceneName: string, sceneItemId: number): string {
  return `${sceneName}\n${sceneItemId}`;
}

export function parseProgramSourcesPersistJson(json: string | null | undefined): Record<string, boolean> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return {};
    const items = (o as { items?: unknown }).items;
    if (!Array.isArray(items)) return {};
    const out: Record<string, boolean> = {};
    for (const row of items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const sceneName = typeof r.sceneName === "string" ? r.sceneName : "";
      const sceneItemId = typeof r.sceneItemId === "number" ? r.sceneItemId : NaN;
      if (!sceneName || !Number.isFinite(sceneItemId)) continue;
      out[sourceTogglePersistKey(sceneName, sceneItemId)] = r.visible === true;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeProgramSourcesForPersist(
  sources: Array<{ sceneName: string; sceneItemId: number; visible: boolean }>
): string {
  return JSON.stringify({
    items: sources.map((s) => ({
      sceneName: s.sceneName,
      sceneItemId: s.sceneItemId,
      visible: s.visible === true,
    })),
  });
}

export function mergeObsSceneItemsWithPersist<
  T extends { sceneName: string; sceneItemId: number; sceneItemEnabled: boolean },
>(items: T[], persist: Record<string, boolean>): T[] {
  return items.map((it) => {
    const k = sourceTogglePersistKey(it.sceneName, it.sceneItemId);
    if (!(k in persist)) return it;
    return { ...it, sceneItemEnabled: persist[k] };
  });
}
