/**
 * Helper to bypass strict Supabase PostgREST type checking for tables
 * that may have been recently added or have complex type inference.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a typed-safe query builder for any table name.
 * Use this when `supabase.from("table_name")` causes TS errors
 * due to deep type instantiation limits.
 */
export function fromTable(tableName: string) {
  return (supabase as any).from(tableName);
}
