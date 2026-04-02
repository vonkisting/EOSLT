export type ProgramSceneSourceRow = {
  sceneItemId: number;
  sourceName: string;
  sourceKind: string;
  sceneItemEnabled: boolean;
};

/**
 * Maps OBS `GetSceneItemList` JSON rows into typed rows (unknown-safe).
 */
export function normalizeProgramSceneItems(raw: unknown): ProgramSceneSourceRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramSceneSourceRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const sceneItemId = typeof r.sceneItemId === "number" ? r.sceneItemId : null;
    const sourceName = typeof r.sourceName === "string" ? r.sourceName : null;
    if (sceneItemId == null || sourceName == null) continue;
    out.push({
      sceneItemId,
      sourceName,
      sourceKind: typeof r.sourceKind === "string" ? r.sourceKind : "",
      sceneItemEnabled: r.sceneItemEnabled === true,
    });
  }
  return out;
}
