import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export type StreamObsUiStateRow = {
  cardOpenByIdJson: string | null;
  layoutJson: string | null;
};

/**
 * Load persisted stream page UI (collapsible open state + card layout).
 */
export const get = query({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<StreamObsUiStateRow> => {
    const normalized = email.toLowerCase().trim();
    const doc = await ctx.db
      .query("streamObsUiState")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!doc) {
      return { cardOpenByIdJson: null, layoutJson: null };
    }
    return {
      cardOpenByIdJson: doc.cardOpenByIdJson ?? null,
      layoutJson: doc.layoutJson ?? null,
    };
  },
});

/**
 * Replace the full card open map (client merges before calling).
 */
export const setCardOpenMap = mutation({
  args: {
    email: v.string(),
    cardOpenByIdJson: v.string(),
  },
  handler: async (ctx, { email, cardOpenByIdJson }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("streamObsUiState")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { cardOpenByIdJson });
      return existing._id;
    }
    return await ctx.db.insert("streamObsUiState", {
      email: normalized,
      cardOpenByIdJson,
    });
  },
});

/**
 * Replace the stream dashboard 3-column layout JSON (card order + sizes).
 */
export const setLayoutJson = mutation({
  args: {
    email: v.string(),
    layoutJson: v.string(),
  },
  handler: async (ctx, { email, layoutJson }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("streamObsUiState")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { layoutJson });
      return existing._id;
    }
    return await ctx.db.insert("streamObsUiState", {
      email: normalized,
      layoutJson,
      cardOpenByIdJson: "{}",
    });
  },
});
