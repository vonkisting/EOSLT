import sql from "mssql";

const POOLHUB_DATABASE_URL = process.env.POOLHUB_DATABASE_URL;

let pool: sql.ConnectionPool | null = null;

/**
 * Get the PoolHub SQL Server pool (read-only usage). Returns null if
 * POOLHUB_DATABASE_URL is not set. Use only for SELECT queries.
 */
function getConnectionConfig(): string {
  const url = POOLHUB_DATABASE_URL!;
  const lower = url.toLowerCase();
  const needsTls =
    !lower.includes("trustservercertificate") || !lower.includes("encrypt=");
  if (!needsTls) return url;
  const extra: string[] = [];
  if (!lower.includes("encrypt=")) extra.push("Encrypt=false");
  if (!lower.includes("trustservercertificate"))
    extra.push("TrustServerCertificate=true");
  return extra.length ? `${url};${extra.join(";")}` : url;
}

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (!POOLHUB_DATABASE_URL) return null;
  if (!pool) {
    try {
      pool = await sql.connect(getConnectionConfig());
    } catch (err) {
      console.error("[PoolHub DB] Connection error:", err);
      const errObj = err instanceof Error ? err : new Error(String(err));
      const code = "code" in errObj && typeof (errObj as NodeJS.ErrnoException).code === "string"
        ? (errObj as NodeJS.ErrnoException).code
        : "";
      let detail = errObj.message;
      if (detail.length > 400) detail = detail.slice(0, 397) + "...";
      const redact = /password|pwd=|connectionstring|user id|data source|server=/i;
      const safeDetail = !redact.test(detail) ? detail : "";
      const message = [
        "PoolHub database is unreachable.",
        "",
        "What this usually means:",
        "• Database is on a private network or on-premises — Vercel cannot reach it. Use a cloud SQL Server or a proxy that Vercel can call.",
        "• Firewall is blocking your host (e.g. Vercel) from the DB host:port. Allow outbound to the SQL Server port (often 1433).",
        "• Wrong Server, Database, User ID, or Password in POOLHUB_DATABASE_URL. Double-check the value in Vercel → Settings → Environment Variables.",
        "• TLS/encryption mismatch — add Encrypt=false;TrustServerCertificate=true to the end of the connection string.",
        "",
        "Next step: In Vercel (or your host) open the deployment → Logs or Runtime Logs. Search for \"[PoolHub DB] Connection error\" to see the exact driver error.",
        code ? `Error code: ${code}` : "",
        safeDetail ? `Driver message: ${safeDetail}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      throw new Error(message);
    }
  }
  return pool;
}

/**
 * Result shape for read-only queries (matches recordset + rowsAffected).
 */
export interface PoolHubQueryResult<T = unknown> {
  rows: T[];
  rowsAffected: number;
}

/**
 * Run a read-only query against the PoolHub SQL Server database. Use only SELECT statements.
 * Parameters use positional placeholders @p1, @p2, ... when values are provided.
 *
 * @example
 * const result = await poolhubQuery<{ id: number; name: string }>(
 *   'SELECT id, name FROM players WHERE tournament_id = @p1',
 *   [tournamentId]
 * );
 * const rows = result?.rows ?? [];
 */
export async function poolhubQuery<T = unknown>(
  text: string,
  values?: unknown[]
): Promise<PoolHubQueryResult<T> | null> {
  const p = await getPool();
  if (!p) return null;
  try {
    const request = p.request();
    if (values?.length) {
      values.forEach((v, i) => {
        request.input(`p${i + 1}`, v);
      });
      const parameterized = text.replace(
        /\$(\d+)/g,
        (_, n) => `@p${n}`
      );
      const result = await request.query<T>(parameterized);
      return {
        rows: result.recordset ?? [],
        rowsAffected: result.rowsAffected?.length ? result.rowsAffected[0] : 0,
      };
    }
    const result = await request.query<T>(text);
    return {
      rows: result.recordset ?? [],
      rowsAffected: result.rowsAffected?.length ? result.rowsAffected[0] : 0,
    };
  } catch (err) {
    console.error("[PoolHub DB] Query error:", err);
    return null;
  }
}
