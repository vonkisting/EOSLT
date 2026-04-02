/**
 * Build a safe ws:// URL for OBS WebSocket from user-supplied host/port.
 * Rejects schemes (must not include ws:// — we add it), basic SSRF tokens, and invalid ports.
 */
export function parseObsPort(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return null;
  return n;
}

export function buildObsWebSocketUrl(hostRaw: string, port: number): string | null {
  const host = hostRaw.trim();
  if (!host || host.length > 253) return null;
  const lower = host.toLowerCase();
  if (lower.startsWith("ws://") || lower.startsWith("wss://")) return null;
  if (/[\s/@?#]/.test(host)) return null;
  if (lower === "169.254.169.254" || lower === "metadata.google.internal") return null;
  return `ws://${host}:${port}`;
}
