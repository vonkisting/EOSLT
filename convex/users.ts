import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get user by email (for Credentials sign-in). Returns null if not found.
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
  },
});

/**
 * Create a user with email and password hash (for registration).
 * Fails if email already exists.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, passwordHash, name }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing) {
      throw new Error("Email already registered");
    }
    return await ctx.db.insert("users", {
      email: normalized,
      passwordHash,
      name: name ?? undefined,
    });
  },
});
