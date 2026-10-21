/**
 * Prefer human-readable display name in chat UIs.
 * Order: display_name → first+last → explicit fallback (may be email when no name exists).
 */
export function resolvePartyLabel(
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null,
  fallback = "Client",
): string {
  const display = (profile?.display_name || "").trim();
  if (display) return display;
  const name = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
  if (name) return name;
  const fb = (fallback || "").trim();
  return fb || "Client";
}
