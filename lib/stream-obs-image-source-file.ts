import type { OBSWebSocket } from "obs-websocket-js";
import type { JsonObject } from "type-fest";
import {
  ensureScenesReady,
  ensureSourceOnProgramScene,
  obsInputExists,
  resolveActiveProgramSceneName,
} from "@/lib/stream-obs-scene-input-base";

const IMAGE_INPUT_KIND = "image_source";

/**
 * Creates or updates an OBS Image Source `file` setting (HTTPS URL or local path).
 * Adds the source to the current program scene when missing.
 */
export async function setImageSourceFileOrCreate(
  obs: OBSWebSocket,
  inputName: string,
  file: string
): Promise<void> {
  await ensureScenesReady(obs);

  const sceneName = await resolveActiveProgramSceneName(obs);
  if (!sceneName) {
    throw new Error("Could not determine the active program scene in OBS.");
  }

  const exists = await obsInputExists(obs, inputName);

  const inputSettings: JsonObject = { file };

  if (!exists) {
    await obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind: IMAGE_INPUT_KIND,
      inputSettings,
      sceneItemEnabled: true,
    });
    return;
  }

  await obs.call("SetInputSettings", {
    inputName,
    inputSettings,
    overlay: true,
  });
  await ensureSourceOnProgramScene(obs, sceneName, inputName);
}
