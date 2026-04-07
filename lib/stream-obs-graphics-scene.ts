import type { OBSWebSocket } from "obs-websocket-js/json";
import type { JsonObject } from "type-fest";
import {
  ensureScenesReady,
  ensureSourceOnScene,
  obsInputExists,
} from "@/lib/stream-obs-scene-input-base";
import { normalizeSceneNames } from "@/lib/stream-obs-scene-list";

const FFMPEG_INPUT_KIND = "ffmpeg_source";
const MEDIA_RESTART = "OBS_MEDIA_INPUT_ACTION_RESTART";

function graphicsInputNameForScene(sceneLabel: string): string {
  const suffix = " — EOSLT";
  const max = 256 - suffix.length;
  const base = sceneLabel.trim().slice(0, Math.max(1, max));
  return `${base}${suffix}`;
}

async function obsSceneExists(obs: OBSWebSocket, sceneName: string): Promise<boolean> {
  const list = await obs.call("GetSceneList");
  return normalizeSceneNames(list.scenes).includes(sceneName);
}

async function ensureSceneByName(obs: OBSWebSocket, sceneName: string): Promise<void> {
  if (await obsSceneExists(obs, sceneName)) return;
  await obs.call("CreateScene", { sceneName });
}

async function tryRestartMedia(obs: OBSWebSocket, inputName: string): Promise<void> {
  try {
    await obs.call("TriggerMediaInputAction", {
      inputName,
      mediaAction: MEDIA_RESTART,
    });
  } catch {
    /* Older inputs or non-media: non-fatal */
  }
}

/**
 * Creates the scene if missing. With `videoUrl`, adds or updates an FFmpeg (media) source and restarts playback.
 */
export async function ensureGraphicsSceneWithOptionalVideo(
  obs: OBSWebSocket,
  sceneName: string,
  videoUrl?: string
): Promise<void> {
  const trimmedScene = sceneName.trim();
  if (!trimmedScene) {
    throw new Error("Scene name is required.");
  }

  await ensureScenesReady(obs);
  await ensureSceneByName(obs, trimmedScene);

  if (!videoUrl?.trim()) {
    return;
  }

  const url = videoUrl.trim();
  const inputName = graphicsInputNameForScene(trimmedScene);
  const settings: JsonObject = {
    local_file: false,
    input: url,
    looping: false,
    restart_on_activate: true,
  };

  const exists = await obsInputExists(obs, inputName);
  if (!exists) {
    await obs.call("CreateInput", {
      sceneName: trimmedScene,
      inputName,
      inputKind: FFMPEG_INPUT_KIND,
      inputSettings: settings,
      sceneItemEnabled: true,
    });
  } else {
    await obs.call("SetInputSettings", {
      inputName,
      inputSettings: settings,
      overlay: true,
    });
    await ensureSourceOnScene(obs, trimmedScene, inputName);
  }

  await tryRestartMedia(obs, inputName);
}
