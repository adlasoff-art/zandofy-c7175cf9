/**
 * Compute effective store seniority in years.
 * - If admin override exists, use it.
 * - Otherwise compute from store created_at date.
 * Returns the number of full years (0 means < 1 year).
 */
export function computeStoreYears(
  override: number | null | undefined,
  autoYears: number | null | undefined,
  createdAt: string | null | undefined
): number {
  // Admin override takes priority
  if (override != null && override > 0) return override;
  // Existing auto-computed value from DB
  if (autoYears != null && autoYears > 0) return autoYears;
  // Compute from creation date
  if (createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
    return years; // 0 = less than 1 year
  }
  return 0;
}

/**
 * Format store years for display.
 * - 0 → "- 1 An" (less than 1 year)
 * - 1 → "1 An"
 * - 2+ → "X Ans"
 */
export function formatStoreYears(years: number): string {
  if (years <= 0) return "- 1 An";
  if (years === 1) return "1 An";
  return `${years} Ans`;
}
