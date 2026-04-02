/** Match `lib/stream-sfx-basename.ts` — Convex cannot import from the Next app tree. */
export function isSafeStreamSfxBasename(id: string): boolean {
  return /^[a-zA-Z0-9 _\-]{1,120}$/.test(id);
}
