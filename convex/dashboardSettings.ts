import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

const locationKeys = [
  "firstWeekLocation1", "firstWeekLocation2", "firstWeekLocation3", "firstWeekLocation4",
  "firstWeekLocation5", "firstWeekLocation6", "firstWeekLocation7", "firstWeekLocation8",
  "secondWeekLocation1", "secondWeekLocation2", "secondWeekLocation3", "secondWeekLocation4",
  "finalsLocation",
] as const;

const uiCollapsedKeys = [
  "uiUsersCardOpen", "uiLeagueCardOpen", "uiPlayersCardOpen",
  "uiWeek1SectionOpen", "uiWeek2SectionOpen", "uiFinalsSectionOpen",
  "uiWeek1Slot0Open", "uiWeek1Slot1Open", "uiWeek1Slot2Open", "uiWeek1Slot3Open",
  "uiWeek1Slot4Open", "uiWeek1Slot5Open", "uiWeek1Slot6Open", "uiWeek1Slot7Open",
] as const;

/**
 * Get public tournament state for the home page (no auth). Returns the first
 * dashboard settings document so unauthenticated users see the same bracket/no-tournament as everyone else.
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("dashboardSettings").first();
    if (!doc) return null;
    return mapDocToSettings(doc);
  },
});

function mapDocToSettings(doc: Doc<"dashboardSettings">) {
  const d = doc as Record<string, unknown>;
  const out: Record<string, string | null | boolean> = {
    leagueName: doc.leagueName,
    season: doc.season,
    leagueGuid: doc.leagueGuid ?? null,
    tournamentStarted: doc.tournamentStarted === true,
    tournamentPaused: doc.tournamentPaused === true,
  };
  for (const key of locationKeys) {
    const val = d[key];
    out[key] = typeof val === "string" ? val : null;
  }
  const locationStartMetaRaw = d.locationStartMeta;
  out.locationStartMeta =
    typeof locationStartMetaRaw === "string" && locationStartMetaRaw.trim() !== ""
      ? locationStartMetaRaw
      : null;
  for (let i = 0; i < 96; i++) {
    const key = `bracketSlot${i}`;
    const val = d[key];
    out[key] = typeof val === "string" ? val : null;
  }
  for (let i = 0; i < 48; i++) {
    const key = `bracketMatchStatus${i}`;
    const val = d[key];
    out[key] = typeof val === "string" ? val : null;
  }
  for (let i = 0; i < 48; i++) {
    for (const prefix of ["bracketScoreTop", "bracketScoreBottom"]) {
      const key = `${prefix}${i}`;
      const val = d[key];
      out[key] = typeof val === "string" ? val : null;
    }
  }
  for (let i = 0; i < 48; i++) {
    const key = `liveScoreGames${i}`;
    const val = d[key];
    out[key] = typeof val === "string" ? val : null;
  }
  const week2Raw = d.week2BracketSlots;
  out.week2BracketSlots = typeof week2Raw === "string" ? week2Raw : null;
  const finalsRaw = d.finalsBracketSlots;
  out.finalsBracketSlots = typeof finalsRaw === "string" ? finalsRaw : null;
  const finalsScoresRaw = d.finalsBracketScores;
  out.finalsBracketScores = typeof finalsScoresRaw === "string" ? finalsScoresRaw : null;
  for (const key of uiCollapsedKeys) {
    const val = d[key];
    out[key] = val === true;
  }
  return out as {
    leagueName: string;
    season: string;
    leagueGuid: string | null;
    tournamentStarted: boolean;
    tournamentPaused: boolean;
  } & Record<(typeof locationKeys)[number], string | null> & { locationStartMeta: string | null } & Record<`bracketSlot${number}`, string | null> & Record<`bracketMatchStatus${number}`, string | null> & Record<`bracketScoreTop${number}` | `bracketScoreBottom${number}`, string | null> & Record<`liveScoreGames${number}`, string | null> & { week2BracketSlots: string | null; finalsBracketSlots: string | null; finalsBracketScores: string | null } & Record<(typeof uiCollapsedKeys)[number], boolean>;
}

/**
 * Get stored league name, season, league GUID, and location fields for the dashboard (by user email).
 */
export const get = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const doc = await ctx.db
      .query("dashboardSettings")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!doc) return null;
    return mapDocToSettings(doc);
  },
});

const BRACKET_SLOT_COUNT = 96;
const bracketSlotKeys = Array.from(
  { length: BRACKET_SLOT_COUNT },
  (_, i) => `bracketSlot${i}` as const
);

const locationArgs = {
  firstWeekLocation1: v.optional(v.string()),
  firstWeekLocation2: v.optional(v.string()),
  firstWeekLocation3: v.optional(v.string()),
  firstWeekLocation4: v.optional(v.string()),
  firstWeekLocation5: v.optional(v.string()),
  firstWeekLocation6: v.optional(v.string()),
  firstWeekLocation7: v.optional(v.string()),
  firstWeekLocation8: v.optional(v.string()),
  secondWeekLocation1: v.optional(v.string()),
  secondWeekLocation2: v.optional(v.string()),
  secondWeekLocation3: v.optional(v.string()),
  secondWeekLocation4: v.optional(v.string()),
  finalsLocation: v.optional(v.string()),
};

/**
 * Store league name, season, optionally league GUID, and location fields (by user email).
 * Omitted fields are left unchanged.
 */
const bracketSlotArgs = Object.fromEntries(
  Array.from({ length: BRACKET_SLOT_COUNT }, (_, i) => [
    `bracketSlot${i}`,
    v.optional(v.string()),
  ])
) as Record<string, ReturnType<typeof v.optional>>;

const bracketMatchStatusKeys = Array.from(
  { length: 48 },
  (_, i) => `bracketMatchStatus${i}` as const
);
const bracketMatchStatusArgs = Object.fromEntries(
  bracketMatchStatusKeys.map((key) => [key, v.optional(v.string())])
) as Record<string, ReturnType<typeof v.optional>>;

const bracketScoreKeys = Array.from({ length: 48 }, (_, i) =>
  [`bracketScoreTop${i}`, `bracketScoreBottom${i}`] as const
).flat();
const bracketScoreArgs = Object.fromEntries(
  bracketScoreKeys.map((key) => [key, v.optional(v.string())])
) as Record<string, ReturnType<typeof v.optional>>;

const liveScoreGamesKeys = Array.from(
  { length: 48 },
  (_, i) => `liveScoreGames${i}` as const
);
const liveScoreGamesArgs = Object.fromEntries(
  liveScoreGamesKeys.map((key) => [key, v.optional(v.string())])
) as Record<string, ReturnType<typeof v.optional>>;

const uiCollapsedArgs = Object.fromEntries(
  uiCollapsedKeys.map((key) => [key, v.optional(v.boolean())])
) as Record<string, ReturnType<typeof v.optional>>;

export const set = mutation({
  args: {
    email: v.string(),
    leagueName: v.string(),
    season: v.string(),
    leagueGuid: v.optional(v.string()),
    tournamentStarted: v.optional(v.boolean()),
    tournamentPaused: v.optional(v.boolean()),
    ...locationArgs,
    locationStartMeta: v.optional(v.string()),
    ...bracketSlotArgs,
    ...bracketMatchStatusArgs,
    ...bracketScoreArgs,
    ...liveScoreGamesArgs,
    week2BracketSlots: v.optional(v.string()),
    finalsBracketSlots: v.optional(v.string()),
    finalsBracketScores: v.optional(v.string()),
    ...uiCollapsedArgs,
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("dashboardSettings")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    const patch: Record<string, string | boolean | undefined> = {
      leagueName: args.leagueName,
      season: args.season,
    };
    if (args.leagueGuid !== undefined) patch.leagueGuid = args.leagueGuid || undefined;
    if (args.tournamentStarted !== undefined) patch.tournamentStarted = args.tournamentStarted;
    if (args.tournamentPaused !== undefined) patch.tournamentPaused = args.tournamentPaused;
    for (const key of locationKeys) {
      const v = (args as Record<string, unknown>)[key];
      if (v !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = (v as string) || undefined;
    }
    if ((args as Record<string, unknown>).locationStartMeta !== undefined) {
      (patch as Record<string, string | boolean | undefined>).locationStartMeta = (args as Record<string, unknown>).locationStartMeta as string || undefined;
    }
    for (const key of bracketSlotKeys) {
      const val = (args as Record<string, unknown>)[key];
      if (val !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = (val as string);
    }
    for (const key of bracketMatchStatusKeys) {
      const val = (args as Record<string, unknown>)[key];
      if (val !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = (val as string);
    }
    for (const key of bracketScoreKeys) {
      const val = (args as Record<string, unknown>)[key];
      if (val !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = (val as string);
    }
    for (const key of liveScoreGamesKeys) {
      const val = (args as Record<string, unknown>)[key];
      if (val !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = (val as string);
    }
    if ((args as Record<string, unknown>).week2BracketSlots !== undefined)
      (patch as Record<string, string | boolean | undefined>).week2BracketSlots = (args as Record<string, unknown>).week2BracketSlots as string ?? undefined;
    if ((args as Record<string, unknown>).finalsBracketSlots !== undefined)
      (patch as Record<string, string | boolean | undefined>).finalsBracketSlots = (args as Record<string, unknown>).finalsBracketSlots as string ?? undefined;
    if ((args as Record<string, unknown>).finalsBracketScores !== undefined)
      (patch as Record<string, string | boolean | undefined>).finalsBracketScores = (args as Record<string, unknown>).finalsBracketScores as string ?? undefined;
    for (const key of uiCollapsedKeys) {
      const val = (args as Record<string, unknown>)[key];
      if (val !== undefined) (patch as Record<string, string | boolean | undefined>)[key] = val as boolean;
    }
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    const insert: Record<string, unknown> = {
      email: normalized,
      leagueName: args.leagueName,
      season: args.season,
      leagueGuid: args.leagueGuid || undefined,
      tournamentStarted: args.tournamentStarted ?? undefined,
      tournamentPaused: args.tournamentPaused ?? undefined,
    };
    for (const key of locationKeys) {
      const v = (args as Record<string, unknown>)[key];
      insert[key] = (v as string) || undefined;
    }
    if ((args as Record<string, unknown>).locationStartMeta !== undefined) {
      insert.locationStartMeta = (args as Record<string, unknown>).locationStartMeta as string || undefined;
    }
    for (const key of bracketSlotKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as string) : undefined;
    }
    for (const key of bracketMatchStatusKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as string) : undefined;
    }
    for (const key of bracketScoreKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as string) : undefined;
    }
    for (const key of liveScoreGamesKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as string) : undefined;
    }
    if ((args as Record<string, unknown>).week2BracketSlots !== undefined)
      insert.week2BracketSlots = (args as Record<string, unknown>).week2BracketSlots as string ?? undefined;
    if ((args as Record<string, unknown>).finalsBracketSlots !== undefined)
      insert.finalsBracketSlots = (args as Record<string, unknown>).finalsBracketSlots as string ?? undefined;
    if ((args as Record<string, unknown>).finalsBracketScores !== undefined)
      insert.finalsBracketScores = (args as Record<string, unknown>).finalsBracketScores as string ?? undefined;
    for (const key of uiCollapsedKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as boolean) : undefined;
    }
    return await ctx.db.insert("dashboardSettings", insert as never);
  },
});
