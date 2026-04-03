/**
 * Build `<select>` options: always include every entry in `pool`, and prepend `current` when it
 * is non-empty and not already in the pool (custom / legacy values).
 */
export function selectOptionsFullPool(pool: string[], current: string): string[] {
  const t = current.trim();
  if (t && !pool.includes(t)) return [t, ...pool];
  return [...pool];
}
