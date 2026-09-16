import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureFreshSession, throwIfEdgeFunctionError } from "@/services/admin-email";

export type StartImpersonationResult = {
  token: string;
  targetName?: string;
  targetUserId: string;
  url: string;
};

/** Only same-origin relative paths (blocks open redirects). */
export function sanitizeImpersonationRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  return path;
}

/**
 * Start staff impersonation of a target user (new tab).
 * Reuses Edge Function `impersonate-user` — no RLS bypass.
 * @param redirectPath optional post-login path (e.g. `/forwarder`)
 */
export async function startImpersonation(
  targetUserId: string,
  redirectPath?: string | null,
): Promise<StartImpersonationResult> {
  if (!targetUserId) {
    throw new Error("Aucun utilisateur cible pour l'impersonation.");
  }

  await ensureFreshSession();
  const res = await supabase.functions.invoke("impersonate-user", {
    body: { action: "start", targetUserId },
  });
  await throwIfEdgeFunctionError(res);

  const token = res.data?.token as string | undefined;
  if (!token) {
    throw new Error("Token d'impersonation manquant.");
  }

  const safeRedirect = sanitizeImpersonationRedirect(redirectPath);
  const qs = new URLSearchParams({ token });
  if (safeRedirect) qs.set("redirect", safeRedirect);

  const url = `${window.location.origin}/impersonate?${qs.toString()}`;
  const opened = window.open(url, "_blank");

  const targetName = (res.data?.targetName as string | undefined) || "utilisateur";

  if (!opened) {
    toast.warning("Popup bloquée — autorisez les popups pour ouvrir l'impersonation.");
  } else {
    toast.success(`Onglet d'impersonation ouvert pour ${targetName}`);
  }

  return {
    token,
    targetName,
    targetUserId,
    url,
  };
}

/**
 * Resolve the user id to impersonate for a forwarder entity.
 */
export function resolveForwarderOwnerUserId(forwarder: {
  owner_user_id?: string | null;
  linked_transporter_user_id?: string | null;
}): string | null {
  return forwarder.owner_user_id || forwarder.linked_transporter_user_id || null;
}

/** Default landing after impersonation when no redirect= is provided. */
export function defaultImpersonationLanding(roles: string[]): string {
  if (roles.includes("admin") || roles.includes("manager")) return "/admin";
  if (roles.includes("vendor")) return "/vendor";
  if (roles.includes("operator")) return "/operator";
  if (roles.includes("forwarder")) return "/forwarder";
  if (roles.includes("rider")) return "/rider";
  if (roles.includes("shipper")) return "/shipper";
  return "/dashboard";
}
