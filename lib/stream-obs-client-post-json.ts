import type { ObsCredentials } from "@/components/stream/useObsProgramSources";

export async function postObsJson<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `Invalid response (${res.status})` } as unknown as T;
  }
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
    return { ...data, ok: false, error: err } as unknown as T;
  }
  return data as T;
}

export function credBody(c: ObsCredentials): Record<string, string> {
  return { host: c.host, port: c.port, password: c.password };
}
