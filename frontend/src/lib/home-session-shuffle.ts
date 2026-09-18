/** Session-stable shuffle for Accueil Tendance feed (not daily). */

const SEED_KEY = "zandofy-home-trend-shuffle-seed";

export const HOME_RESHUFFLE_EVENT = "home-trend-reshuffle";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getHomeShuffleSeed(): string {
  try {
    const existing = sessionStorage.getItem(SEED_KEY);
    if (existing) return existing;
  } catch {
    /* private mode */
  }
  return bumpHomeShuffleSeed();
}

/** New seed for pull-to-refresh / re-tap Accueil. */
export function bumpHomeShuffleSeed(): string {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    sessionStorage.setItem(SEED_KEY, seed);
  } catch {
    /* ignore */
  }
  return seed;
}

export function shuffleBySessionSeed<T extends { id: string }>(
  items: T[],
  seed = getHomeShuffleSeed(),
): T[] {
  return [...items].sort(
    (a, b) => hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`),
  );
}

export function requestHomeReshuffle(): void {
  bumpHomeShuffleSeed();
  window.dispatchEvent(new CustomEvent(HOME_RESHUFFLE_EVENT));
}
