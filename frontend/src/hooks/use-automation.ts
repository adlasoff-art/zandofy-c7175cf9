import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";


interface AutomationWorkflow {
  id: string;
  name: string;
  trigger_type: string;
  delay_days: number;
  delay_minutes: number;
  channel: string;
  condition_has_account: boolean | null;
  condition_has_order: boolean | null;
  condition_max_days_since_signup: number | null;
  condition_countries: string[] | null;
  condition_cities: string[] | null;
  condition_roles: string[] | null;
  ab_test_enabled: boolean | null;
  ab_split_percent: number | null;
  popup_title: string | null;
  popup_content: string | null;
  popup_image_url: string | null;
  popup_cta_label: string | null;
  popup_cta_link: string | null;
  display_frequency: string;
  max_displays: number | null;
}

export interface AutomationVariantContent {
  variant_label: 'A' | 'B';
  popup_title: string | null;
  popup_content: string | null;
  popup_image_url: string | null;
  popup_cta_label: string | null;
  popup_cta_link: string | null;
}

interface ProgressRecord {
  workflow_id: string;
  display_count: number;
  last_displayed_at: string | null;
}

function getAnonId(): string {
  const key = "zandofy_anon_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function getSessionKey(workflowId: string): string {
  return `auto_session_${workflowId}`;
}

export function useAutomation() {
  const [matchedWorkflow, setMatchedWorkflow] = useState<AutomationWorkflow | null>(null);
  const [variant, setVariant] = useState<AutomationVariantContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      try {
        // 1. Fetch active popup workflows via la vue publique (n'expose pas
        // email_html_content / push_body / email_subject — Lot Sécurité v4.2)
        const { data: workflows } = await (supabase as any)
          .from("automation_workflows_public")
          .select("*")
          .in("channel", ["popup", "popup_push", "all"])
          .order("sort_order", { ascending: true });

        if (!workflows || workflows.length === 0 || cancelled) {
          setLoading(false);
          return;
        }

        // 2. Check user state
        const { data: { user } } = await supabase.auth.getUser();
        const hasAccount = !!user;
        let hasOrder = false;
        let daysSinceSignup: number | null = null;
        let userCountry: string | null = null;
        let userCity: string | null = null;
        let userRoles: string[] = [];

        if (user) {
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .not("status", "in", '("cancelled","returned")');
          hasOrder = (count ?? 0) > 0;

          // Tolérance schéma : si residence_country/city n'existent pas encore
          // en prod (migration non déployée), on retombe sur created_at seul.
          let profile: any = null;
          {
            const res = await (supabase as any)
              .from("profiles")
              .select("created_at, residence_country, residence_city")
              .eq("id", user.id)
              .maybeSingle();
            if (res.error && (res.error.code === "42703" || /residence_/.test(res.error.message ?? ""))) {
              const fallback = await (supabase as any)
                .from("profiles")
                .select("created_at")
                .eq("id", user.id)
                .maybeSingle();
              profile = fallback.data ?? null;
            } else {
              profile = res.data ?? null;
            }
          }
          if (profile?.created_at) {
            daysSinceSignup = Math.floor(
              (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
          }
          userCountry = profile?.residence_country ?? null;
          userCity = profile?.residence_city ?? null;

          const { data: roleRows } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          userRoles = (roleRows || []).map((r: any) => r.role);
        }

        // 3. Get progress records
        const anonId = getAnonId();
        let progressRecords: ProgressRecord[] = [];

        if (user) {
          const { data } = await (supabase as any)
            .from("automation_user_progress")
            .select("workflow_id, display_count, last_displayed_at")
            .eq("user_id", user.id);
          progressRecords = data || [];
        } else {
          const { data } = await (supabase as any)
            .from("automation_user_progress")
            .select("workflow_id, display_count, last_displayed_at")
            .eq("anon_id", anonId);
          progressRecords = data || [];
        }

        // 4. Find first matching workflow
        for (const wf of workflows as AutomationWorkflow[]) {
          // Check trigger conditions
          if (wf.trigger_type === "visit_no_account" && hasAccount) continue;
          if (wf.trigger_type === "account_created" && !hasAccount) continue;
          if (wf.trigger_type === "visit_no_order" && (!hasAccount || hasOrder)) continue;
          if (wf.trigger_type === "no_order_delay" && (!hasAccount || hasOrder)) continue;

          // Check explicit conditions
          if (wf.condition_has_account === true && !hasAccount) continue;
          if (wf.condition_has_account === false && hasAccount) continue;
          if (wf.condition_has_order === true && !hasOrder) continue;
          if (wf.condition_has_order === false && hasOrder) continue;

          if (wf.condition_max_days_since_signup !== null && daysSinceSignup !== null) {
            if (daysSinceSignup > wf.condition_max_days_since_signup) continue;
          }

          // Geo targeting
          if (Array.isArray(wf.condition_countries) && wf.condition_countries.length > 0) {
            if (!userCountry) continue;
            const set = new Set(wf.condition_countries.map((c) => c.toLowerCase()));
            if (!set.has(userCountry.toLowerCase())) continue;
          }
          if (Array.isArray(wf.condition_cities) && wf.condition_cities.length > 0) {
            if (!userCity) continue;
            const set = new Set(wf.condition_cities.map((c) => c.toLowerCase()));
            if (!set.has(userCity.toLowerCase())) continue;
          }
          // Role targeting
          if (Array.isArray(wf.condition_roles) && wf.condition_roles.length > 0) {
            if (userRoles.length === 0) continue;
            const intersect = userRoles.some((r) => wf.condition_roles!.includes(r));
            if (!intersect) continue;
          }

          // Check delay for time-based triggers
          if (wf.trigger_type === "no_order_delay" && daysSinceSignup !== null) {
            if (daysSinceSignup < wf.delay_days) continue;
          }

          // Check display frequency
          const progress = progressRecords.find((p) => p.workflow_id === wf.id);
          const displayCount = progress?.display_count ?? 0;

          if (wf.max_displays !== null && displayCount >= wf.max_displays) continue;

          if (wf.display_frequency === "once" && displayCount > 0) continue;

          if (wf.display_frequency === "daily" && progress?.last_displayed_at) {
            const lastDate = new Date(progress.last_displayed_at).toDateString();
            if (lastDate === new Date().toDateString()) continue;
          }

          if (wf.display_frequency === "once_per_session") {
            if (sessionStorage.getItem(getSessionKey(wf.id))) continue;
          }

          if (!cancelled) {
            setMatchedWorkflow(wf);
            // Resolve A/B variant content via RPC
            try {
              const { data: vLabel } = await (supabase as any).rpc("assign_automation_variant", {
                p_workflow_id: wf.id,
                p_user_id: user?.id ?? null,
                p_anon_id: user ? null : anonId,
              });
              const label = (vLabel as 'A' | 'B') || 'A';
              const { data: content } = await (supabase as any).rpc("get_automation_content", {
                p_workflow_id: wf.id,
                p_variant: label,
              });
              if (!cancelled) setVariant(content as AutomationVariantContent);
            } catch {
              if (!cancelled) {
                setVariant({
                  variant_label: 'A',
                  popup_title: wf.popup_title,
                  popup_content: wf.popup_content,
                  popup_image_url: wf.popup_image_url,
                  popup_cta_label: wf.popup_cta_label,
                  popup_cta_link: wf.popup_cta_link,
                });
              }
            }
          }
          break;
        }
      } catch (err) {
        console.error("[Automation] evaluation error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    evaluate();
    return () => { cancelled = true; };
  }, []);

  const recordDisplay = useCallback(async (workflowId: string, variantLabel: 'A' | 'B' = 'A') => {
    sessionStorage.setItem(getSessionKey(workflowId), "1");

    const { data: { user } } = await supabase.auth.getUser();
    const anonId = getAnonId();

    // Check if progress exists
    let existing: any = null;
    if (user) {
      const { data } = await (supabase as any)
        .from("automation_user_progress")
        .select("id, display_count")
        .eq("user_id", user.id)
        .eq("workflow_id", workflowId)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await (supabase as any)
        .from("automation_user_progress")
        .select("id, display_count")
        .eq("anon_id", anonId)
        .eq("workflow_id", workflowId)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      await (supabase as any)
        .from("automation_user_progress")
        .update({
          display_count: existing.display_count + 1,
          last_displayed_at: new Date().toISOString(),
          status: "sent",
          assigned_variant: variantLabel,
        })
        .eq("id", existing.id);
    } else {
      await (supabase as any)
        .from("automation_user_progress")
        .insert({
          user_id: user?.id ?? null,
          anon_id: user ? null : anonId,
          workflow_id: workflowId,
          display_count: 1,
          last_displayed_at: new Date().toISOString(),
          status: "sent",
          assigned_variant: variantLabel,
        });
    }

    // Log displayed event with variant for metrics
    await (supabase as any).from("automation_events").insert({
      workflow_id: workflowId,
      user_id: user?.id ?? null,
      anon_id: user ? null : anonId,
      event_type: "displayed",
      variant_label: variantLabel,
    });
  }, []);

  return { matchedWorkflow, variant, loading, recordDisplay };
}
