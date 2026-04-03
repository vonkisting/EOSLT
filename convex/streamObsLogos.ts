import { mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type ParsedLogoRow = {
  id: string;
  storageId: Id<"_storage">;
  fileName: string;
  obsImageSourceName: string;
};

const LOGO_FILE_NAME_MAX_LEN = 512;

/**
 * Persisted logo label: must match the imported `File.name` from the client (no basename stripping or trim).
 */
function assertImportedFileName(raw: string): string {
  if (raw.length === 0) throw new Error("File name is required");
  if (raw.length > LOGO_FILE_NAME_MAX_LEN) throw new Error("File name is too long");
  if (/[\r\n\0]/.test(raw)) throw new Error("Invalid file name");
  return raw;
}

/** OBS input default: filename without extension (imported `fileName` may include path segments from the client). */
function fileNameWithoutExtension(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return base;
  return base.slice(0, dot);
}

function defaultLogoObsSourceName(fileName: string): string {
  const stem = fileNameWithoutExtension(fileName);
  const name = stem.length > 0 ? stem : "Image";
  return name.slice(0, 256);
}

function parseStreamLogoRows(raw: string | undefined): ParsedLogoRow[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ParsedLogoRow[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const storageId = typeof o.storageId === "string" ? o.storageId.trim() : "";
    const fileName = typeof o.fileName === "string" ? o.fileName : "";
    const obsImageSourceName =
      typeof o.obsImageSourceName === "string" ? o.obsImageSourceName.trim() : "";
    if (!id || !storageId || !fileName || !obsImageSourceName) continue;
    if (id.length > 128 || fileName.length > LOGO_FILE_NAME_MAX_LEN || obsImageSourceName.length > 256)
      continue;
    out.push({
      id,
      storageId: storageId as Id<"_storage">,
      fileName,
      obsImageSourceName,
    });
  }
  return out;
}

/**
 * Logo rows with Convex storage URLs for the stream dashboard / OBS wiring.
 */
export async function resolveStreamLogosForProfile(
  ctx: QueryCtx,
  raw: string | undefined
): Promise<
  Array<{ id: string; fileName: string; obsImageSourceName: string; url: string | null }>
> {
  const rows = parseStreamLogoRows(raw);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      fileName: r.fileName,
      obsImageSourceName: r.obsImageSourceName,
      url: await ctx.storage.getUrl(r.storageId),
    }))
  );
}

/**
 * Short-lived URL to POST a file into Convex storage (profile must exist).
 */
export const generateStreamLogoUploadUrl = mutation({
  args: { email: v.string(), connectionName: v.string() },
  handler: async (ctx, { email, connectionName }) => {
    const normalized = email.toLowerCase().trim();
    const name = connectionName.trim();
    if (!name) throw new Error("Connection name is required");
    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) throw new Error("Save this connection profile before uploading logos.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const appendStreamLogo = mutation({
  args: {
    email: v.string(),
    connectionName: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    logoId: v.string(),
    obsImageSourceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const name = args.connectionName.trim();
    if (!name) throw new Error("Connection name is required");
    const logoId = args.logoId.trim();
    if (!logoId || logoId.length > 128) throw new Error("Invalid logo id");

    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) throw new Error("Profile not found");

    const fileName = assertImportedFileName(args.fileName);
    const obsImageSourceName = (
      args.obsImageSourceName?.trim() || defaultLogoObsSourceName(fileName)
    ).slice(0, 256);

    const existing = parseStreamLogoRows(doc.streamLogosJson);
    if (existing.some((r) => r.id === logoId)) throw new Error("Logo id already exists");

    const next: ParsedLogoRow[] = [
      ...existing,
      {
        id: logoId,
        storageId: args.storageId,
        fileName,
        obsImageSourceName,
      },
    ];

    await ctx.db.patch(doc._id, {
      streamLogosJson: JSON.stringify(next),
      updatedAt: Date.now(),
    });
  },
});

export const updateStreamLogoObsImageSourceName = mutation({
  args: {
    email: v.string(),
    connectionName: v.string(),
    logoId: v.string(),
    obsImageSourceName: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const name = args.connectionName.trim();
    if (!name) throw new Error("Connection name is required");
    const obsImageSourceName = args.obsImageSourceName.trim().slice(0, 256);
    if (!obsImageSourceName) throw new Error("OBS image source name is required");

    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) throw new Error("Profile not found");

    const rows = parseStreamLogoRows(doc.streamLogosJson);
    const lid = args.logoId.trim();
    const idx = rows.findIndex((r) => r.id === lid);
    if (idx === -1) throw new Error("Logo not found");

    rows[idx] = { ...rows[idx], obsImageSourceName };
    await ctx.db.patch(doc._id, {
      streamLogosJson: JSON.stringify(rows),
      updatedAt: Date.now(),
    });
  },
});

export const removeStreamLogo = mutation({
  args: { email: v.string(), connectionName: v.string(), logoId: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.toLowerCase().trim();
    const name = args.connectionName.trim();
    if (!name) throw new Error("Connection name is required");

    const doc = await ctx.db
      .query("streamObsProfiles")
      .withIndex("by_email_and_name", (q) =>
        q.eq("email", normalized).eq("connectionName", name)
      )
      .unique();
    if (!doc) throw new Error("Profile not found");

    const rows = parseStreamLogoRows(doc.streamLogosJson);
    const lid = args.logoId.trim();
    const idx = rows.findIndex((r) => r.id === lid);
    if (idx === -1) return;

    const [removed] = rows.splice(idx, 1);
    await ctx.storage.delete(removed.storageId);
    await ctx.db.patch(doc._id, {
      streamLogosJson: JSON.stringify(rows),
      updatedAt: Date.now(),
    });
  },
});
