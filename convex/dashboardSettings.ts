import { mutation, query } from "./_generated/server";
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
    const out: Record<string, string | null | boolean> = {
      leagueName: doc.leagueName,
      season: doc.season,
      leagueGuid: doc.leagueGuid ?? null,
      tournamentStarted: (doc as Record<string, unknown>).tournamentStarted === true,
      tournamentPaused: (doc as Record<string, unknown>).tournamentPaused === true,
    };
    for (const key of locationKeys) {
      const val = (doc as Record<string, unknown>)[key];
      out[key] = typeof val === "string" ? val : null;
    }
    for (let i = 0; i < 96; i++) {
      const key = `bracketSlot${i}`;
      const val = (doc as Record<string, unknown>)[key];
      out[key] = typeof val === "string" ? val : null;
    }
    for (let i = 0; i < 48; i++) {
      const key = `bracketMatchStatus${i}`;
      const val = (doc as Record<string, unknown>)[key];
      out[key] = typeof val === "string" ? val : null;
    }
    for (let i = 0; i < 48; i++) {
      for (const prefix of ["bracketScoreTop", "bracketScoreBottom"]) {
        const key = `${prefix}${i}`;
        const val = (doc as Record<string, unknown>)[key];
        out[key] = typeof val === "string" ? val : null;
      }
    }
    for (let i = 0; i < 48; i++) {
      const key = `liveScoreGames${i}`;
      const val = (doc as Record<string, unknown>)[key];
      out[key] = typeof val === "string" ? val : null;
    }
    for (const key of uiCollapsedKeys) {
      const val = (doc as Record<string, unknown>)[key];
      out[key] = val === true;
    }
    return out as {
      leagueName: string;
      season: string;
      leagueGuid: string | null;
      tournamentStarted: boolean;
      tournamentPaused: boolean;
    } & Record<(typeof locationKeys)[number], string | null> & Record<`bracketSlot${number}`, string | null> & Record<`bracketMatchStatus${number}`, string | null> & Record<`bracketScoreTop${number}` | `bracketScoreBottom${number}`, string | null> & Record<`liveScoreGames${number}`, string | null> & Record<(typeof uiCollapsedKeys)[number], boolean>;
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
    ...bracketSlotArgs,
    ...bracketMatchStatusArgs,
    ...bracketScoreArgs,
    ...liveScoreGamesArgs,
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
    for (const key of uiCollapsedKeys) {
      const val = (args as Record<string, unknown>)[key];
      insert[key] = val !== undefined ? (val as boolean) : undefined;
    }
    return await ctx.db.insert("dashboardSettings", insert as never);
  },
});
