import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import {
  normalizeProgramSceneItems,
  type ProgramSceneSourceRow,
} from "@/lib/stream-obs-scene-items";
import { normalizeSceneNames } from "@/lib/stream-obs-scene-list";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import type { OBSWebSocket } from "obs-websocket-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SceneItemRow = ProgramSceneSourceRow & { sceneName: string };

/**
 * Top-level scene items plus one level of group expansion (nested sources).
 */
async function listItemsForObsScene(obs: OBSWebSocket, sceneName: string): Promise<SceneItemRow[]> {
  const list = await obs.call("GetSceneItemList", { sceneName });
  const rows = normalizeProgramSceneItems(list.sceneItems);
  const out: SceneItemRow[] = [];

  for (const row of rows) {
    const kind = row.sourceKind.toLowerCase();
    if (kind === "group") {
      try {
        const groupList = await obs.call("GetGroupSceneItemList", { sceneName: row.sourceName });
        const nested = normalizeProgramSceneItems(groupList.sceneItems);
        for (const n of nested) {
          out.push({
            sceneName,
            sceneItemId: n.sceneItemId,
            sourceName: n.sourceName,
            sourceKind: n.sourceKind,
            sceneItemEnabled: n.sceneItemEnabled,
          });
        }
      } catch {
        out.push({
          sceneName,
          sceneItemId: row.sceneItemId,
          sourceName: row.sourceName,
          sourceKind: row.sourceKind,
          sceneItemEnabled: row.sceneItemEnabled,
        });
      }
    } else {
      out.push({
        sceneName,
        sceneItemId: row.sceneItemId,
        sourceName: row.sourceName,
        sourceKind: row.sourceKind,
        sceneItemEnabled: row.sceneItemEnabled,
      });
    }
  }

  return out;
}

/**
 * POST /api/stream/obs/program-scene-sources
 * Lists scene items from every OBS scene (not only the program scene), with group contents expanded.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !canAccessStream(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: ObsJsonBody;
  try {
    body = (await request.json()) as ObsJsonBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const creds = parseObsRequestCredentials(body);
  if (!creds.ok) {
    return NextResponse.json({ ok: false, error: creds.error }, { status: 400 });
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    const sceneList = await obs.call("GetSceneList");
    const sceneNames = normalizeSceneNames(sceneList.scenes);
    const programSceneName =
      typeof sceneList.currentProgramSceneName === "string" && sceneList.currentProgramSceneName
        ? sceneList.currentProgramSceneName
        : null;

    const items: SceneItemRow[] = [];
    for (const name of sceneNames) {
      const chunk = await listItemsForObsScene(obs, name);
      items.push(...chunk);
    }

    return { programSceneName, items };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    programSceneName: result.data.programSceneName,
    items: result.data.items,
  });
}
