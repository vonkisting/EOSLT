import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

type SnapshotOk = {
  ok: true;
  scenes: string[];
  currentProgramSceneName: string | null;
  items: Array<{
    sceneName: string;
    sceneItemId: number;
    sourceName: string;
    sourceKind: string;
    sceneItemEnabled: boolean;
  }>;
  inputs: Array<{
    inputName: string;
    inputKind?: string;
    volume: number;
    muted: boolean;
  }>;
};

type SnapshotFail = { ok: false; error: string };

export type ObsPanelsSnapshotFetchResult = SnapshotOk | SnapshotFail;

/**
 * Loads scenes, program scene items, and audio inputs in one server round-trip (one OBS WebSocket).
 */
export async function fetchObsPanelsSnapshot(
  credentials: ObsCredentials
): Promise<ObsPanelsSnapshotFetchResult> {
  try {
    const res = await fetch("/api/stream/obs/panels-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        host: credentials.host,
        port: credentials.port,
        password: credentials.password,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      scenes?: unknown;
      currentProgramSceneName?: unknown;
      items?: unknown;
      inputs?: unknown;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    }
    if (!Array.isArray(data.scenes) || !Array.isArray(data.items) || !Array.isArray(data.inputs)) {
      return { ok: false, error: "Invalid snapshot from server." };
    }
    const currentProgramSceneName =
      typeof data.currentProgramSceneName === "string" && data.currentProgramSceneName
        ? data.currentProgramSceneName
        : null;
    return {
      ok: true,
      scenes: data.scenes.filter((s): s is string => typeof s === "string"),
      currentProgramSceneName,
      items: data.items as SnapshotOk["items"],
      inputs: data.inputs as SnapshotOk["inputs"],
    };
  } catch {
    return { ok: false, error: "Network error — could not load OBS panels." };
  }
}
