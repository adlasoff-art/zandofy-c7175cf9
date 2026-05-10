import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SeoOverride = {
  path: string;
  title: string | null;
  og_title: string | null;
  description: string | null;
  og_image: string | null;
  keywords: string[] | null;
  robots: string;
  jsonld_extra: Record<string, any> | null;
};

let _cache: { rows: Record<string, SeoOverride>; expiresAt: number } | null = null;
const TTL = 60_000;

async function fetchAll(): Promise<Record<string, SeoOverride>> {
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.rows;
  const { data, error } = await supabase
    .from("seo_page_overrides")
    .select("path,title,og_title,description,og_image,keywords,robots,jsonld_extra");
  if (error || !data) {
    _cache = { rows: {}, expiresAt: now + 5_000 };
    return {};
  }
  const map: Record<string, SeoOverride> = {};
  for (const r of data as any[]) map[r.path] = r;
  _cache = { rows: map, expiresAt: now + TTL };
  return map;
}

/** Public: get a single override by path (sync state, async fetch). */
export function useSeoOverride(path: string): SeoOverride | null {
  const [override, setOverride] = useState<SeoOverride | null>(
    _cache?.rows?.[path] || null,
  );
  useEffect(() => {
    let alive = true;
    fetchAll().then((m) => {
      if (alive) setOverride(m[path] || null);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return override;
}

/** Admin: list all overrides (no cache). */
export async function listSeoOverrides(): Promise<SeoOverride[]> {
  const { data } = await supabase
    .from("seo_page_overrides")
    .select("*")
    .order("path");
  return (data as any[]) || [];
}

export function clearSeoOverridesCache() {
  _cache = null;
}
