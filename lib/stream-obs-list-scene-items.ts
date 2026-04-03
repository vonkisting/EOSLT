import {
  normalizeProgramSceneItems,
  type ProgramSceneSourceRow,
} from "@/lib/stream-obs-scene-items";
import type { OBSWebSocket } from "obs-websocket-js/json";

export type SceneItemRow = ProgramSceneSourceRow & { sceneName: string };

/**
 * Scene items for one OBS scene, expanding one level of group sources.
 */
export async function listItemsForObsScene(
  obs: OBSWebSocket,
  sceneName: string
): Promise<SceneItemRow[]> {
  const list = await obs.call("GetSceneItemList", { sceneName });
  const rows = normalizeProgramSceneItems(list.sceneItems);
  const out: SceneItemRow[] = [];

  for (const row of rows) {
    const kind = row.sourceKind.toLowerCase();
    if (kind === "group") {
      try {
        const groupList = await obs.call("GetGroupSceneItemList", { sceneName: row.sourceName });
        const nested = normalizeProgramSceneItems(groupList.sceneItems);
        for (const n of nested) {
          out.push({
            sceneName,
            sceneItemId: n.sceneItemId,
            sourceName: n.sourceName,
            sourceKind: n.sourceKind,
            sceneItemEnabled: n.sceneItemEnabled,
          });
        }
      } catch {
        out.push({
          sceneName,
          sceneItemId: row.sceneItemId,
          sourceName: row.sourceName,
          sourceKind: row.sourceKind,
          sceneItemEnabled: row.sceneItemEnabled,
        });
      }
    } else {
      out.push({
        sceneName,
        sceneItemId: row.sceneItemId,
        sourceName: row.sourceName,
        sourceKind: row.sourceKind,
        sceneItemEnabled: row.sceneItemEnabled,
      });
    }
  }

  return out;
}
