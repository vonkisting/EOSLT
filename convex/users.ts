import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * List all users (for dashboard). Returns safe fields only (no passwordHash).
 * Includes image for avatar resolution (e.g. Live Scoring header by poolhubPlayerName).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("users").collect();
    return docs.map(({ _id, email, name, image, poolhubPlayerName }) => ({
      _id,
      email: email ?? "",
      name: name ?? null,
      image: image ?? null,
      poolhubPlayerName: poolhubPlayerName ?? null,
    }));
  },
});

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

/**
 * Ensure a user exists in Convex (idempotent). Used when signing in with Google
 * or after any auth so that every authenticated user has a Convex user row.
 * If the user exists, does nothing. If not, inserts with email and optional name/image.
 */
export const ensureUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { email, name, image }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("users", {
      email: normalized,
      name: name ?? undefined,
      image: image ?? undefined,
    });
  },
});

/**
 * Set the PoolHub player name for the user with the given email.
 * Call only with the authenticated user's own email (enforced by UI / auth layer).
 */
export const setPoolhubPlayerName = mutation({
  args: {
    email: v.string(),
    poolhubPlayerName: v.string(),
  },
  handler: async (ctx, { email, poolhubPlayerName }) => {
    const normalized = email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.patch(user._id, { poolhubPlayerName: poolhubPlayerName.trim() || undefined });
    return user._id;
  },
});

/**
 * Set the display name for the user with the given email.
 * Call only with the authenticated user's own email (enforced by UI / auth layer).
 */
export const setName = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, name }) => {
    const normalized = email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!user) {
      return await ctx.db.insert("users", {
        email: normalized,
        name: name.trim() || undefined,
      });
    }
    await ctx.db.patch(user._id, { name: name.trim() || undefined });
    return user._id;
  },
});

/**
 * Delete a single user by id. Used by the dashboard to remove an account from the users list.
 * Clears the user's PoolHub player link first so that name can be claimed by another user.
 * Does not remove the user from Auth.js; they may be re-created on next sign-in if using OAuth.
 */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, { poolhubPlayerName: undefined });
    }
    await ctx.db.delete(userId);
    return { deleted: true };
  },
});

/**
 * Delete all users (for resetting data). Run from Convex dashboard: Functions → users.deleteAllUsers → Run with {}.
 */
export const deleteAllUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length };
  },
});
