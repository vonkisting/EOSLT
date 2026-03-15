import sql from "mssql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug-poolhub – diagnose PoolHub connection and League query.
 * Open in browser: http://localhost:3000/api/debug-poolhub
 * Remove or restrict in production.
 */
export async function GET() {
  const connStr = process.env.POOLHUB_DATABASE_URL;
  const steps: { step: string; ok: boolean; detail?: string }[] = [];

  steps.push({
    step: "POOLHUB_DATABASE_URL is set",
    ok: !!connStr,
    detail: connStr ? "set" : "Missing in .env.local",
  });

  if (!connStr) {
    return NextResponse.json({
      ok: false,
      steps,
      hint: "Add POOLHUB_DATABASE_URL to .env.local and restart the dev server.",
    });
  }

  const lower = connStr.toLowerCase();
  let conn = connStr;
  if (!lower.includes("trustservercertificate") || !lower.includes("encrypt=")) {
    const extra: string[] = [];
    if (!lower.includes("encrypt=")) extra.push("Encrypt=false");
    if (!lower.includes("trustservercertificate"))
      extra.push("TrustServerCertificate=true");
    conn = `${connStr};${extra.join(";")}`;
  }

  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(conn);
    steps.push({ step: "Connect to database", ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({ step: "Connect to database", ok: false, detail: msg });
    return NextResponse.json({
      ok: false,
      steps,
      hint: "Check Server, Database, User ID, Password. For local/some hosts add: Encrypt=false;TrustServerCertificate=true",
    });
  }

  try {
    const result = await pool
      .request()
      .query<{ LeagueGUID: string; LeagueName: string }>(
        "SELECT LeagueGUID, LeagueName FROM League ORDER BY LeagueName"
      );
    const rows = result.recordset ?? [];
    steps.push({
      step: "Query: SELECT LeagueGUID, LeagueName FROM League",
      ok: true,
      detail: `${rows.length} row(s)`,
    });
    return NextResponse.json({
      ok: true,
      steps,
      rowCount: rows.length,
      sample: rows[0] ?? null,
      hint:
        rows.length === 0
          ? "Table is empty or column/table names may differ. Try Leagues, or columns like 'Name' instead of 'LeagueName'."
          : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({
      step: "Query: SELECT LeagueGUID, LeagueName FROM League",
      ok: false,
      detail: msg,
    });
    return NextResponse.json({
      ok: false,
      steps,
      error: msg,
      hint:
        msg.includes("Invalid object name")
          ? "Table name may be wrong. Try 'Leagues' (plural) or 'dbo.League' in lib/poolhub-queries.ts."
          : msg.includes("Invalid column name")
            ? "Column names may differ. Update LeagueGUID/LeagueName in lib/poolhub-queries.ts to match your schema."
            : "Check server terminal for full error. Connection may need Encrypt=false;TrustServerCertificate=true.",
    });
  } finally {
    if (pool) void pool.close().catch(() => {});
  }
}
