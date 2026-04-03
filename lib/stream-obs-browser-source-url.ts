import type { OBSWebSocket } from "obs-websocket-js/json";
import type { JsonObject } from "type-fest";
import {
  ensureScenesReady,
  ensureSourceOnProgramScene,
  obsInputExists,
  resolveActiveProgramSceneName,
} from "@/lib/stream-obs-scene-input-base";

const BROWSER_INPUT_KIND = "browser_source";

export { isObsInputNotFoundError } from "@/lib/stream-obs-scene-input-base";

export type BrowserSourcePixelSize = {
  width: number;
  height: number;
};

const DEFAULT_BROWSER_SIZE: BrowserSourcePixelSize = { width: 1920, height: 1080 };

/**
 * Ensures at least one scene exists (creates "Overlay" if needed), then creates the browser source
 * or updates its URL. If the source already exists, only settings are updated; the source is also
 * added to the current program scene when missing (e.g. after a scene switch).
 *
 * @param pixelSize - When set, used for CreateInput and SetInputSettings. When omitted, new sources
 *   use 1920×1080; existing sources only get `url` updated (preserves user-resized scoreboard sources).
 */
export async function setBrowserSourceUrlOrCreate(
  obs: OBSWebSocket,
  inputName: string,
  url: string,
  pixelSize?: BrowserSourcePixelSize
): Promise<void> {
  await ensureScenesReady(obs);

  const sceneName = await resolveActiveProgramSceneName(obs);
  if (!sceneName) {
    throw new Error("Could not determine the active program scene in OBS.");
  }

  const exists = await obsInputExists(obs, inputName);

  const size = pixelSize ?? DEFAULT_BROWSER_SIZE;

  if (!exists) {
    await obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind: BROWSER_INPUT_KIND,
      inputSettings: { url, width: size.width, height: size.height },
      sceneItemEnabled: true,
    });
    return;
  }

  const inputSettings: JsonObject = {
    url,
    ...(pixelSize ? { width: pixelSize.width, height: pixelSize.height } : {}),
  };

  await obs.call("SetInputSettings", {
    inputName,
    inputSettings,
    overlay: true,
  });
  await ensureSourceOnProgramScene(obs, sceneName, inputName);
}
