/**
 * Maps OBS `GetSceneList` `scenes` array entries to scene names (unknown-safe).
 */
export function normalizeSceneNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const sceneName = typeof r.sceneName === "string" ? r.sceneName : null;
    if (sceneName) names.push(sceneName);
  }
  return names;
}
