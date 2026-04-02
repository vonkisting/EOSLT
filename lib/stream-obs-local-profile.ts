const LS_KEY = "eoslt.streamObs.lastProfile";

/**
 * Last-selected stream OBS connection profile name (per signed-in email), for reload UX.
 */
export function readLastStreamObsProfileName(email: string): string {
  try {
    if (typeof window === "undefined") return "";
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return "";
    const o = JSON.parse(raw) as { email?: string; connectionName?: string };
    if (o.email !== email.toLowerCase().trim()) return "";
    return typeof o.connectionName === "string" ? o.connectionName : "";
  } catch {
    return "";
  }
}

export function writeLastStreamObsProfileName(email: string, connectionName: string): void {
  try {
    if (typeof window === "undefined") return;
    const e = email.toLowerCase().trim();
    const name = connectionName.trim();
    if (!name) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ email: e, connectionName: name }));
  } catch {
    /* ignore quota / private mode */
  }
}
