import type { OBSWebSocket } from "obs-websocket-js/json";
import type { JsonObject } from "type-fest";
import {
  ensureScenesReady,
  ensureSourceOnProgramScene,
  obsInputExists,
  resolveActiveProgramSceneName,
} from "@/lib/stream-obs-scene-input-base";

const BROWSER_INPUT_KIND = "browser_source";

/** Matches OBS Advanced Audio Properties → Audio Monitoring → “Monitor and Output”. */
const OBS_MONITORING_MONITOR_AND_OUTPUT = "OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT";

export { isObsInputNotFoundError } from "@/lib/stream-obs-scene-input-base";

export type BrowserSourcePixelSize = {
  width: number;
  height: number;
};

export type SetBrowserSourceUrlOptions = {
  /** When set, used for CreateInput and SetInputSettings. When omitted, new sources use 1920×1080. */
  pixelSize?: BrowserSourcePixelSize;
  /** Maps to OBS browser source `reroute_audio` (“Control audio via OBS”). */
  rerouteAudio?: boolean;
  /**
   * Sets Advanced Audio Properties → Audio Monitoring to “Monitor and Output” (requires a monitor
   * device in OBS Settings → Audio). Failures are ignored so URL wiring still succeeds.
   */
  audioMonitorAndOutput?: boolean;
  /** Applied only when the input is **created** (`SetInputVolume`, OBS dB). */
  initialInputVolumeDb?: number;
};

const DEFAULT_BROWSER_SIZE: BrowserSourcePixelSize = { width: 1920, height: 1080 };

async function trySetBrowserSourceMonitorAndOutput(
  obs: OBSWebSocket,
  inputName: string
): Promise<void> {
  try {
    await obs.call("SetInputAudioMonitorType", {
      inputName,
      monitorType: OBS_MONITORING_MONITOR_AND_OUTPUT,
    });
  } catch {
    /* No monitoring device, or input has no audio track yet — non-fatal */
  }
}

async function trySetInitialInputVolumeDb(
  obs: OBSWebSocket,
  inputName: string,
  inputVolumeDb: number
): Promise<void> {
  try {
    await obs.call("SetInputVolume", { inputName, inputVolumeDb });
  } catch {
    /* Input may not expose volume yet — non-fatal */
  }
}

/**
 * Ensures at least one scene exists (creates "Overlay" if needed), then creates the browser source
 * or updates its URL. If the source already exists, only settings are updated; the source is also
 * added to the current program scene when missing (e.g. after a scene switch).
 */
export async function setBrowserSourceUrlOrCreate(
  obs: OBSWebSocket,
  inputName: string,
  url: string,
  options?: SetBrowserSourceUrlOptions
): Promise<void> {
  await ensureScenesReady(obs);

  const sceneName = await resolveActiveProgramSceneName(obs);
  if (!sceneName) {
    throw new Error("Could not determine the active program scene in OBS.");
  }

  const exists = await obsInputExists(obs, inputName);

  const size = options?.pixelSize ?? DEFAULT_BROWSER_SIZE;
  const rerouteAudio = options?.rerouteAudio === true;

  const browserSettings = (base: JsonObject): JsonObject => {
    if (rerouteAudio) base.reroute_audio = true;
    return base;
  };

  if (!exists) {
    await obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind: BROWSER_INPUT_KIND,
      inputSettings: browserSettings({
        url,
        width: size.width,
        height: size.height,
      }),
      sceneItemEnabled: true,
    });
    if (options?.audioMonitorAndOutput === true) {
      await trySetBrowserSourceMonitorAndOutput(obs, inputName);
    }
    const volDb = options?.initialInputVolumeDb;
    if (typeof volDb === "number" && Number.isFinite(volDb)) {
      await trySetInitialInputVolumeDb(obs, inputName, volDb);
    }
    return;
  }

  const inputSettings: JsonObject = {
    url,
    ...(options?.pixelSize
      ? { width: options.pixelSize.width, height: options.pixelSize.height }
      : {}),
    ...(rerouteAudio ? { reroute_audio: true } : {}),
  };

  await obs.call("SetInputSettings", {
    inputName,
    inputSettings,
    overlay: true,
  });
  await ensureSourceOnProgramScene(obs, sceneName, inputName);
  if (options?.audioMonitorAndOutput === true) {
    await trySetBrowserSourceMonitorAndOutput(obs, inputName);
  }
}
