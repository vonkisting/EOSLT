import type { OBSWebSocket } from "obs-websocket-js/json";
import { OBSWebSocketError } from "obs-websocket-js/json";
import { normalizeProgramSceneItems } from "@/lib/stream-obs-scene-items";
import { normalizeSceneNames } from "@/lib/stream-obs-scene-list";

const OVERLAY_SCENE_NAME = "Overlay";

/**
 * True when OBS reports the input/source does not exist (typical code 600).
 */
export function isObsInputNotFoundError(err: unknown): boolean {
  if (err instanceof OBSWebSocketError) {
    if (err.code === 600) return true;
    const m = err.message.toLowerCase();
    return (
      m.includes("not found") ||
      m.includes("no source") ||
      m.includes("unknown input") ||
      m.includes("specified input")
    );
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes("not found") || m.includes("no source was found");
  }
  return false;
}

function resolveProgramSceneName(scene: Record<string, unknown>): string {
  const a = scene.sceneName;
  const b = scene.currentProgramSceneName;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof b === "string" && b.trim()) return b.trim();
  return "";
}

/**
 * If OBS has no scenes, create "Overlay" and make it the program scene.
 */
export async function ensureScenesReady(obs: OBSWebSocket): Promise<void> {
  const list = await obs.call("GetSceneList");
  const names = normalizeSceneNames(list.scenes);
  if (names.length > 0) return;

  await obs.call("CreateScene", { sceneName: OVERLAY_SCENE_NAME });
  await obs.call("SetCurrentProgramScene", { sceneName: OVERLAY_SCENE_NAME });
}

export async function resolveActiveProgramSceneName(obs: OBSWebSocket): Promise<string> {
  const current = await obs.call("GetCurrentProgramScene");
  const fromCurrent = resolveProgramSceneName(current as Record<string, unknown>);
  if (fromCurrent) return fromCurrent;

  const list = await obs.call("GetSceneList");
  const program =
    typeof list.currentProgramSceneName === "string" ? list.currentProgramSceneName.trim() : "";
  if (program) return program;

  const first = normalizeSceneNames(list.scenes)[0];
  return first ?? "";
}

export async function obsInputExists(obs: OBSWebSocket, inputName: string): Promise<boolean> {
  try {
    await obs.call("GetInputSettings", { inputName });
    return true;
  } catch (e) {
    if (isObsInputNotFoundError(e)) return false;
    throw e;
  }
}

/**
 * Whether `sourceName` appears on the scene (including one level inside groups).
 */
async function programSceneUsesSource(
  obs: OBSWebSocket,
  sceneName: string,
  sourceName: string
): Promise<boolean> {
  const list = await obs.call("GetSceneItemList", { sceneName });
  const rows = normalizeProgramSceneItems(list.sceneItems);

  for (const row of rows) {
    if (row.sourceName === sourceName) return true;
    if (row.sourceKind.toLowerCase() === "group") {
      try {
        const groupList = await obs.call("GetGroupSceneItemList", { sceneName: row.sourceName });
        const nested = normalizeProgramSceneItems(groupList.sceneItems);
        if (nested.some((n) => n.sourceName === sourceName)) return true;
      } catch {
        /* group list failed */
      }
    }
  }
  return false;
}

export async function ensureSourceOnProgramScene(
  obs: OBSWebSocket,
  sceneName: string,
  sourceName: string
): Promise<void> {
  const onScene = await programSceneUsesSource(obs, sceneName, sourceName);
  if (onScene) return;
  await obs.call("CreateSceneItem", {
    sceneName,
    sourceName,
    sceneItemEnabled: true,
  });
}

/** Ensures `sourceName` appears as a scene item on `sceneName` (not necessarily the program scene). */
export async function ensureSourceOnScene(
  obs: OBSWebSocket,
  sceneName: string,
  sourceName: string
): Promise<void> {
  await ensureSourceOnProgramScene(obs, sceneName, sourceName);
}
