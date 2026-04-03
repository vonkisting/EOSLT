import { listItemsForObsScene, type SceneItemRow } from "@/lib/stream-obs-list-scene-items";
import { normalizeSceneNames } from "@/lib/stream-obs-scene-list";
import { obsVolumeDbToUiPercent } from "@/lib/stream-obs-volume-ui";
import type { OBSWebSocket } from "obs-websocket-js/json";

export type ObsPanelsSnapshot = {
  sceneNames: string[];
  currentProgramSceneName: string | null;
  items: SceneItemRow[];
  audioInputs: Array<{
    inputName: string;
    inputKind: string;
    volume: number;
    muted: boolean;
  }>;
};

type InputRow = { inputName: string; inputKind: string };

function parseInputRows(raw: unknown): InputRow[] {
  if (!Array.isArray(raw)) return [];
  const out: InputRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const inputName = typeof o.inputName === "string" ? o.inputName : "";
    if (!inputName) continue;
    const inputKind = typeof o.inputKind === "string" ? o.inputKind : "";
    out.push({ inputName, inputKind });
  }
  return out;
}

async function audioInputsForObs(obs: OBSWebSocket): Promise<ObsPanelsSnapshot["audioInputs"]> {
  const list = await obs.call("GetInputList");
  const rows = parseInputRows(list.inputs);
  const out: ObsPanelsSnapshot["audioInputs"] = [];

  for (const row of rows) {
    try {
      const vol = await obs.call("GetInputVolume", { inputName: row.inputName });
      const mute = await obs.call("GetInputMute", { inputName: row.inputName });
      const db = typeof vol.inputVolumeDb === "number" ? vol.inputVolumeDb : -60;
      out.push({
        inputName: row.inputName,
        inputKind: row.inputKind,
        volume: obsVolumeDbToUiPercent(db),
        muted: mute.inputMuted === true,
      });
    } catch {
      /* input has no volume control */
    }
  }

  out.sort((a, b) => a.inputName.localeCompare(b.inputName, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * One WebSocket session: scene list, all scene items (with group expansion), and audio inputs.
 */
export async function buildObsPanelsSnapshot(obs: OBSWebSocket): Promise<ObsPanelsSnapshot> {
  const sceneList = await obs.call("GetSceneList");
  const sceneNames = normalizeSceneNames(sceneList.scenes);
  const currentProgramSceneName =
    typeof sceneList.currentProgramSceneName === "string" && sceneList.currentProgramSceneName
      ? sceneList.currentProgramSceneName
      : null;

  const items: SceneItemRow[] = [];
  for (const name of sceneNames) {
    const chunk = await listItemsForObsScene(obs, name);
    items.push(...chunk);
  }

  const audioInputs = await audioInputsForObs(obs);

  return {
    sceneNames,
    currentProgramSceneName,
    items,
    audioInputs,
  };
}
