import { STREAM_OBS_CARD_IDS } from "@/components/stream/streamObsCardIds";

export const STREAM_OBS_LAYOUT_JSON_VERSION = 1 as const;

/** Collapsible stream cards that participate in the 3-column layout (not OBS Connection). */
export const STREAM_OBS_GRID_CARD_IDS: readonly string[] = [
  STREAM_OBS_CARD_IDS.sceneSelection,
  STREAM_OBS_CARD_IDS.soundEffects,
  STREAM_OBS_CARD_IDS.graphicsEffects,
  STREAM_OBS_CARD_IDS.camerasSources,
  STREAM_OBS_CARD_IDS.audio,
  STREAM_OBS_CARD_IDS.tournamentSettings,
  STREAM_OBS_CARD_IDS.tournamentResults,
  STREAM_OBS_CARD_IDS.scoreboard,
];

export type StreamObsCardSize = {
  minHeightPx?: number;
  minWidthPx?: number;
};

export type StreamObsLayoutStateV1 = {
  v: typeof STREAM_OBS_LAYOUT_JSON_VERSION;
  columns: [string[], string[], string[]];
  sizes: Partial<Record<string, StreamObsCardSize>>;
};

const DEFAULT_COLUMNS: [string[], string[], string[]] = [
  [
    STREAM_OBS_CARD_IDS.sceneSelection,
    STREAM_OBS_CARD_IDS.soundEffects,
    STREAM_OBS_CARD_IDS.graphicsEffects,
  ],
  [
    STREAM_OBS_CARD_IDS.camerasSources,
    STREAM_OBS_CARD_IDS.audio,
    STREAM_OBS_CARD_IDS.tournamentSettings,
  ],
  [STREAM_OBS_CARD_IDS.tournamentResults, STREAM_OBS_CARD_IDS.scoreboard],
];

const GRID_SET = new Set(STREAM_OBS_GRID_CARD_IDS);

function cloneCols(c: [string[], string[], string[]]): [string[], string[], string[]] {
  return [c[0].slice(), c[1].slice(), c[2].slice()];
}

function isValidLayout(o: unknown): o is { v: number; columns: [string[], string[], string[]]; sizes?: unknown } {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  if (r.v !== STREAM_OBS_LAYOUT_JSON_VERSION) return false;
  if (!Array.isArray(r.columns) || r.columns.length !== 3) return false;
  const cols = r.columns as unknown[];
  for (const col of cols) {
    if (!Array.isArray(col)) return false;
    for (const id of col) {
      if (typeof id !== "string" || !GRID_SET.has(id)) return false;
    }
  }
  const seen = new Set<string>();
  for (const col of cols) {
    for (const id of col as string[]) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  if (seen.size !== STREAM_OBS_GRID_CARD_IDS.length) return false;
  return true;
}

function sanitizeSizes(raw: unknown): Partial<Record<string, StreamObsCardSize>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<string, StreamObsCardSize>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!GRID_SET.has(k) || !v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const sh: StreamObsCardSize = {};
    if (typeof o.minHeightPx === "number" && Number.isFinite(o.minHeightPx)) {
      sh.minHeightPx = Math.round(o.minHeightPx);
    }
    if (typeof o.minWidthPx === "number" && Number.isFinite(o.minWidthPx)) {
      sh.minWidthPx = Math.round(o.minWidthPx);
    }
    if (sh.minHeightPx != null || sh.minWidthPx != null) out[k] = sh;
  }
  return out;
}

export function defaultStreamObsLayout(): StreamObsLayoutStateV1 {
  return {
    v: STREAM_OBS_LAYOUT_JSON_VERSION,
    columns: cloneCols(DEFAULT_COLUMNS),
    sizes: {},
  };
}

export function parseStreamObsLayoutJson(json: string | null): StreamObsLayoutStateV1 {
  if (!json?.trim()) return defaultStreamObsLayout();
  try {
    const o = JSON.parse(json) as unknown;
    if (isValidLayout(o)) {
      return {
        v: STREAM_OBS_LAYOUT_JSON_VERSION,
        columns: cloneCols(o.columns),
        sizes: sanitizeSizes(o.sizes),
      };
    }
  } catch {
    /* fall through */
  }
  return defaultStreamObsLayout();
}

export function serializeStreamObsLayout(state: StreamObsLayoutStateV1): string {
  return JSON.stringify(state);
}
