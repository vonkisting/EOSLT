import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema. Add tables and indexes here.
 * Run `bunx convex dev` to create/link your Convex project and push schema.
 */
export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
  }).index("by_email", ["email"]),
});
