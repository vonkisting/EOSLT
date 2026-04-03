import { buildObsWebSocketUrl } from "@/lib/stream-obs-url";
import { OBSWebSocket } from "obs-websocket-js/json";

const CONNECT_TIMEOUT_MS = 12_000;

/**
 * Connects to OBS, runs `work`, then disconnects. For short-lived server routes.
 */
export async function withObsWebSocket<T>(
  host: string,
  port: number,
  password: string,
  work: (obs: OBSWebSocket) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = buildObsWebSocketUrl(host, port);
  if (!url) {
    return { ok: false, error: "Invalid host" };
  }

  const obs = new OBSWebSocket();
  try {
    await Promise.race([
      obs.connect(url, password, { rpcVersion: 1 }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), CONNECT_TIMEOUT_MS);
      }),
    ]);
    const data = await work(obs);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect to OBS";
    return { ok: false, error: message };
  } finally {
    try {
      await obs.disconnect();
    } catch {
      /* ignore */
    }
  }
}
