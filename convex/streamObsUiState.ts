import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Load persisted collapsible card open state for the stream page (per user email).
 */
export const get = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const doc = await ctx.db
      .query("streamObsUiState")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    return doc?.cardOpenByIdJson ?? null;
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
