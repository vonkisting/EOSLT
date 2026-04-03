import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import { obsPortOrError, withObsWebSocketBrowser } from "@/lib/stream-obs-browser-with-connection";
import { credBody, postObsJson } from "@/lib/stream-obs-client-post-json";
import { streamObsUseBrowserTransport } from "@/lib/stream-obs-transport";
import { uiPercentToObsVolumeDb } from "@/lib/stream-obs-volume-ui";

export async function obsClientConnect(credentials: ObsCredentials): Promise<{
  ok: boolean;
  error?: string;
  obsVersion?: string;
  /** OBS may return string or number depending on protocol encoder. */
  obsWebSocketVersion?: number | string;
  platform?: string;
}> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/connect", credBody(credentials));
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => obs.call("GetVersion")
  );
  if (!r.ok) return { ok: false, error: r.error };
  const v = r.data;
  return {
    ok: true,
    obsVersion: v.obsVersion,
    obsWebSocketVersion: v.obsWebSocketVersion,
    platform: v.platform,
  };
}

export async function obsClientSetProgramScene(
  credentials: ObsCredentials,
  sceneName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/set-program-scene", {
      ...credBody(credentials),
      sceneName,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => obs.call("SetCurrentProgramScene", { sceneName })
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function obsClientSetSceneItemEnabled(
  credentials: ObsCredentials,
  args: {
    sceneName: string;
    sceneItemId: number;
    sceneItemEnabled: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/set-scene-item-enabled", {
      ...credBody(credentials),
      ...args,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => obs.call("SetSceneItemEnabled", args)
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function obsClientSetInputVolume(
  credentials: ObsCredentials,
  inputName: string,
  volume: number
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/set-input-volume", {
      ...credBody(credentials),
      inputName,
      volume,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const inputVolumeDb = uiPercentToObsVolumeDb(volume);
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => obs.call("SetInputVolume", { inputName, inputVolumeDb })
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function obsClientSetInputMute(
  credentials: ObsCredentials,
  inputName: string,
  inputMuted: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/set-input-mute", {
      ...credBody(credentials),
      inputName,
      inputMuted,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => obs.call("SetInputMute", { inputName, inputMuted })
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
