import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * List all venue names for location dropdowns (sorted).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("venues").collect();
    const names = docs.map((d) => d.name).filter((n) => n != null && n !== "");
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  },
});

/**
 * Replace all venues with the given list. Used when syncing from PoolHub (run once or on demand).
 */
export const setAll = mutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, { names }) => {
    const existing = await ctx.db.query("venues").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    const toInsert = [...new Set(names)].filter((n) => n.trim() !== "");
    for (const name of toInsert) {
      await ctx.db.insert("venues", { name: name.trim() });
    }
    return toInsert.length;
  },
});
