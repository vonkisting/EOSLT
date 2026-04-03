import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveStreamLogosForProfile } from "./streamObsLogos";
import { isSafeStreamSfxBasename } from "./streamSfxBasename";

function newOverlayAudioKey(): string {
  const u = new Uint8Array(24);
  crypto.getRandomValues(u);
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * List saved connection profile names for the stream OBS page (newest activity first).
 */
export const listByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const docs = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .collect();
    return docs
      .map((d) => ({ connectionName: d.connectionName, updatedAt: d.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Load one profile by email + connection name (trimmed match).
 */
export const get = query({
  args: { email: v.string(), connectionName: v.string() },
  handler: async (ctx, { email, connectionName }) => {
    const normalized = email.toLowerCase().trim();
    const name = connectionName.trim();
    if (!name) return null;
    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) return null;
    const streamLogos = await resolveStreamLogosForProfile(ctx, doc.streamLogosJson);
    return { ...doc, streamLogos };
  },
});

/**
 * Public read for OBS browser source: latest sound cue for this overlay key only.
 */
/**
 * Public read for scoreboard browser overlay (same `k` as SFX overlay).
 */
export const getScoreboardByOverlayKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const trimmed = key.trim();
    if (!trimmed) return null;
    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_overlay_audio_key", (q) => q.eq("overlayAudioKey", trimmed))
      .unique();
    if (!doc?.scoreboardJson?.trim()) return null;
    try {
      const o = JSON.parse(doc.scoreboardJson) as Record<string, unknown>;
      return {
        awayName: typeof o.awayName === "string" ? o.awayName : "",
        homeName: typeof o.homeName === "string" ? o.homeName : "",
      };
    } catch {
      return null;
    }
  },
});

/** Public read for tournament results browser overlay (same `k` as scoreboard / SFX). */
export const getTournamentResultsByOverlayKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const trimmed = key.trim();
    if (!trimmed) return null;
    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_overlay_audio_key", (q) => q.eq("overlayAudioKey", trimmed))
      .unique();
    if (!doc) return null;
    return { tournamentSettingsJson: doc.tournamentSettingsJson ?? "" };
  },
});

export const getSfxCueByOverlayKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const trimmed = key.trim();
    if (!trimmed) return null;
    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_overlay_audio_key", (q) => q.eq("overlayAudioKey", trimmed))
      .unique();
    if (!doc || doc.sfxCueSeq == null || !doc.sfxCueSoundId) return null;
    return { soundId: doc.sfxCueSoundId, seq: doc.sfxCueSeq };
  },
});

/**
 * Increment cue so the overlay listener plays `soundId` (validated list).
 */
export const cueOverlaySfx = mutation({
  args: { overlayKey: v.string(), soundId: v.string() },
  handler: async (ctx, { overlayKey, soundId }) => {
    const key = overlayKey.trim();
    if (!key || !isSafeStreamSfxBasename(soundId)) return;

    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_overlay_audio_key", (q) => q.eq("overlayAudioKey", key))
      .unique();
    if (!doc) return;

    const seq = (doc.sfxCueSeq ?? 0) + 1;
    await ctx.db.patch(doc._id, {
      sfxCueSeq: seq,
      sfxCueSoundId: soundId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Same as cueing by overlay key, but looks up the profile by email + connection name
 * (stream dashboard). Ensures `overlayAudioKey` exists so the browser URL keeps working.
 */
export const cueOverlaySfxByProfile = mutation({
  args: {
    email: v.string(),
    connectionName: v.string(),
    soundId: v.string(),
  },
  handler: async (ctx, { email, connectionName, soundId }) => {
    const normalized = email.toLowerCase().trim();
    const name = connectionName.trim();
    if (!name || !isSafeStreamSfxBasename(soundId)) return;

    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) return;

    const now = Date.now();
    let nextKey = doc.overlayAudioKey;
    if (!nextKey) {
      nextKey = newOverlayAudioKey();
      await ctx.db.patch(doc._id, { overlayAudioKey: nextKey, updatedAt: now });
    }

    const seq = (doc.sfxCueSeq ?? 0) + 1;
    await ctx.db.patch(doc._id, {
      sfxCueSeq: seq,
      sfxCueSoundId: soundId,
      updatedAt: now,
    });
  },
});

/**
 * Create or update fields for a named connection profile.
 */
export const upsert = mutation({
  args: {
    email: v.string(),
    connectionName: v.string(),
    host: v.optional(v.string()),
    port: v.optional(v.string()),
    websocketPassword: v.optional(v.string()),
    activeScene: v.optional(v.string()),
    audioChannelsJson: v.optional(v.string()),
    scoreboardJson: v.optional(v.string()),
    tournamentSettingsJson: v.optional(v.string()),
    scoreboardBrowserSourceName: v.optional(v.string()),
    resultsBrowserSourceName: v.optional(v.string()),
    sfxBrowserSourceName: v.optional(v.string()),
    lastSfx: v.optional(v.string()),
    overlayPushedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const connectionName = args.connectionName.trim();
    if (!connectionName) {
      throw new Error("Connection name is required");
    }

    const existing = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", email).eq("connectionName", connectionName)
      )
      .unique();

    const now = Date.now();
    const ensureKey = existing?.overlayAudioKey ?? newOverlayAudioKey();

    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        ...(!existing.overlayAudioKey ? { overlayAudioKey: ensureKey } : {}),
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
        ...(args.websocketPassword !== undefined ? { websocketPassword: args.websocketPassword } : {}),
        ...(args.activeScene !== undefined ? { activeScene: args.activeScene } : {}),
        ...(args.audioChannelsJson !== undefined ? { audioChannelsJson: args.audioChannelsJson } : {}),
        ...(args.scoreboardJson !== undefined ? { scoreboardJson: args.scoreboardJson } : {}),
        ...(args.tournamentSettingsJson !== undefined
          ? { tournamentSettingsJson: args.tournamentSettingsJson }
          : {}),
        ...(args.scoreboardBrowserSourceName !== undefined
          ? { scoreboardBrowserSourceName: args.scoreboardBrowserSourceName }
          : {}),
        ...(args.resultsBrowserSourceName !== undefined
          ? { resultsBrowserSourceName: args.resultsBrowserSourceName }
          : {}),
        ...(args.sfxBrowserSourceName !== undefined
          ? { sfxBrowserSourceName: args.sfxBrowserSourceName }
          : {}),
        ...(args.lastSfx !== undefined ? { lastSfx: args.lastSfx } : {}),
        ...(args.overlayPushedAt !== undefined ? { overlayPushedAt: args.overlayPushedAt } : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert("streamObsProfiles", {
      email,
      connectionName,
      host: args.host ?? "",
      port: args.port ?? "4455",
      overlayAudioKey: ensureKey,
      updatedAt: now,
      ...(args.websocketPassword !== undefined ? { websocketPassword: args.websocketPassword } : {}),
      ...(args.activeScene !== undefined ? { activeScene: args.activeScene } : {}),
      ...(args.audioChannelsJson !== undefined ? { audioChannelsJson: args.audioChannelsJson } : {}),
      ...(args.scoreboardJson !== undefined ? { scoreboardJson: args.scoreboardJson } : {}),
      ...(args.tournamentSettingsJson !== undefined
        ? { tournamentSettingsJson: args.tournamentSettingsJson }
        : {}),
      ...(args.scoreboardBrowserSourceName !== undefined
        ? { scoreboardBrowserSourceName: args.scoreboardBrowserSourceName }
        : {}),
      ...(args.resultsBrowserSourceName !== undefined
        ? { resultsBrowserSourceName: args.resultsBrowserSourceName }
        : {}),
      ...(args.sfxBrowserSourceName !== undefined
        ? { sfxBrowserSourceName: args.sfxBrowserSourceName }
        : {}),
      ...(args.lastSfx !== undefined ? { lastSfx: args.lastSfx } : {}),
      ...(args.overlayPushedAt !== undefined ? { overlayPushedAt: args.overlayPushedAt } : {}),
    });
  },
});
