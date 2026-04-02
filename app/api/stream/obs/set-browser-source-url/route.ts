import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  inputName?: string;
  url?: string;
};

/**
 * POST /api/stream/obs/set-browser-source-url
 * Sets the `url` setting on an existing OBS Browser Source input.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !canAccessStream(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const creds = parseObsRequestCredentials(body);
  if (!creds.ok) {
    return NextResponse.json({ ok: false, error: creds.error }, { status: 400 });
  }

  const inputName =
    typeof body.inputName === "string" && body.inputName.trim()
      ? body.inputName.trim().slice(0, 256)
      : "EOSLT Scoreboard";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
    return NextResponse.json({ ok: false, error: "url must be an http(s) URL" }, { status: 400 });
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await obs.call("SetInputSettings", {
      inputName,
      inputSettings: { url },
      overlay: true,
    });
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error.includes("No source was found") || result.error.includes("not found")
            ? `No OBS input named "${inputName}". Add a Browser Source with that name, then try again.`
            : result.error,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
