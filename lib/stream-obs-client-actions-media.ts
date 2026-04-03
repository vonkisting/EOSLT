import type { ObsCredentials } from "@/components/stream/useObsProgramSources";
import {
  setBrowserSourceUrlOrCreate,
  type SetBrowserSourceUrlOptions,
} from "@/lib/stream-obs-browser-source-url";
import { obsPortOrError, withObsWebSocketBrowser } from "@/lib/stream-obs-browser-with-connection";
import { credBody, postObsJson } from "@/lib/stream-obs-client-post-json";
import { setImageSourceFileOrCreate } from "@/lib/stream-obs-image-source-file";
import { streamObsUseBrowserTransport } from "@/lib/stream-obs-transport";
import { obsVolumeDbToUiPercent } from "@/lib/stream-obs-volume-ui";

export async function obsClientAudioInputs(credentials: ObsCredentials): Promise<{
  ok: boolean;
  error?: string;
  inputs?: Array<{ inputName: string; inputKind?: string; volume: number; muted: boolean }>;
}> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/audio-inputs", credBody(credentials));
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    async (obs) => {
      const list = await obs.call("GetInputList");
      const raw = list.inputs;
      const out: Array<{ inputName: string; inputKind: string; volume: number; muted: boolean }> =
        [];
      if (Array.isArray(raw)) {
        for (const x of raw) {
          if (!x || typeof x !== "object") continue;
          const o = x as Record<string, unknown>;
          const inputName = typeof o.inputName === "string" ? o.inputName : "";
          if (!inputName) continue;
          const inputKind = typeof o.inputKind === "string" ? o.inputKind : "";
          try {
            const vol = await obs.call("GetInputVolume", { inputName });
            const mute = await obs.call("GetInputMute", { inputName });
            const db = typeof vol.inputVolumeDb === "number" ? vol.inputVolumeDb : -60;
            out.push({
              inputName,
              inputKind,
              volume: obsVolumeDbToUiPercent(db),
              muted: mute.inputMuted === true,
            });
          } catch {
            /* no volume */
          }
        }
      }
      out.sort((a, b) => a.inputName.localeCompare(b.inputName, undefined, { sensitivity: "base" }));
      return out;
    }
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, inputs: r.data };
}

export async function obsClientSetBrowserSourceUrl(
  credentials: ObsCredentials,
  inputName: string,
  url: string,
  options?: SetBrowserSourceUrlOptions
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    const body: Record<string, unknown> = { ...credBody(credentials), inputName, url };
    if (options?.pixelSize) {
      body.browserWidth = options.pixelSize.width;
      body.browserHeight = options.pixelSize.height;
    }
    if (options?.rerouteAudio) {
      body.controlAudioViaObs = true;
    }
    if (options?.audioMonitorAndOutput) {
      body.audioMonitorAndOutput = true;
    }
    if (typeof options?.initialInputVolumeDb === "number" && Number.isFinite(options.initialInputVolumeDb)) {
      body.initialInputVolumeDb = options.initialInputVolumeDb;
    }
    return postObsJson("/api/stream/obs/set-browser-source-url", body);
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => setBrowserSourceUrlOrCreate(obs, inputName, url, options)
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function obsClientRefreshBrowserSource(
  credentials: ObsCredentials,
  inputName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/refresh-browser-source", {
      ...credBody(credentials),
      inputName,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) =>
      obs.call("PressInputPropertiesButton", {
        inputName,
        propertyName: "refreshnocache",
      })
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function obsClientSetImageSourceFile(
  credentials: ObsCredentials,
  inputName: string,
  file: string
): Promise<{ ok: boolean; error?: string }> {
  if (!streamObsUseBrowserTransport()) {
    return postObsJson("/api/stream/obs/set-image-source-file", {
      ...credBody(credentials),
      inputName,
      file,
    });
  }
  const p = obsPortOrError(credentials.port);
  if (!p.ok) return { ok: false, error: p.error };
  const r = await withObsWebSocketBrowser(
    credentials.host.trim(),
    p.port,
    credentials.password,
    (obs) => setImageSourceFileOrCreate(obs, inputName, file)
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
