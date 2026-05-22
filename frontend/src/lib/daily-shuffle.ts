/** Deterministic daily order — same seed = same order all day (UTC date). */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailySeedDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Stable sort key for an item id on a given calendar day. */
export function dailySortKey(id: string, dateSeed = getDailySeedDate()): number {
  return hashString(`${dateSeed}:${id}`);
}

/** Returns a new array sorted in pseudo-random daily order. */
export function shuffleByDailySeed<T extends { id: string }>(
  items: T[],
  dateSeed = getDailySeedDate(),
): T[] {
  return [...items].sort(
    (a, b) => dailySortKey(a.id, dateSeed) - dailySortKey(b.id, dateSeed),
  );
}
