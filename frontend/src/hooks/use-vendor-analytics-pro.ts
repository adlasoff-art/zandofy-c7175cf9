import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsFilters {
  storeId: string;
  start: Date;
  end: Date;
  categoryId?: string | null;
  city?: string | null;
  paymentMethod?: string | null;
}

export interface KpiBlock {
  orders: number;
  revenue: number;
  gross_margin: number;
  margin_pct: number;
  aov: number;
  unique_customers: number;
}

export interface KpisResponse {
  current: KpiBlock;
  previous: KpiBlock & { gross_margin: number };
}

export function useVendorAnalyticsKpis(f: AnalyticsFilters) {
  return useQuery({
    queryKey: ["va-kpis", f.storeId, f.start, f.end, f.categoryId, f.city, f.paymentMethod],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_analytics_kpis", {
        p_store_id: f.storeId,
        p_start: f.start.toISOString(),
        p_end: f.end.toISOString(),
        p_category_id: f.categoryId ?? null,
        p_city: f.city ?? null,
        p_payment_method: f.paymentMethod ?? null,
      });
      if (error) throw error;
      return data as unknown as KpisResponse;
    },
    enabled: !!f.storeId,
  });
}

export function useVendorAnalyticsTimeseries(f: AnalyticsFilters) {
  return useQuery({
    queryKey: ["va-ts", f.storeId, f.start, f.end, f.categoryId, f.city, f.paymentMethod],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_analytics_timeseries", {
        p_store_id: f.storeId,
        p_start: f.start.toISOString(),
        p_end: f.end.toISOString(),
        p_category_id: f.categoryId ?? null,
        p_city: f.city ?? null,
        p_payment_method: f.paymentMethod ?? null,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ day: string; orders: number; revenue: number; margin: number }>;
    },
    enabled: !!f.storeId,
  });
}

export function useVendorAnalyticsFunnel(f: Pick<AnalyticsFilters, "storeId" | "start" | "end">) {
  return useQuery({
    queryKey: ["va-funnel", f.storeId, f.start, f.end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_analytics_funnel", {
        p_store_id: f.storeId,
        p_start: f.start.toISOString(),
        p_end: f.end.toISOString(),
      });
      if (error) throw error;
      return data as unknown as {
        views: number; cart_additions: number; checkouts: number; paid: number;
        view_to_cart_pct: number; cart_to_checkout_pct: number; checkout_to_paid_pct: number; overall_cvr_pct: number;
      };
    },
    enabled: !!f.storeId,
  });
}

export function useVendorAnalyticsTopProducts(f: Pick<AnalyticsFilters, "storeId" | "start" | "end">, limit = 20) {
  return useQuery({
    queryKey: ["va-top", f.storeId, f.start, f.end, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_analytics_top_products", {
        p_store_id: f.storeId,
        p_start: f.start.toISOString(),
        p_end: f.end.toISOString(),
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        product_id: string; product_name: string; units_sold: number; revenue: number; margin: number;
        current_stock: number; is_low_stock: boolean;
      }>;
    },
    enabled: !!f.storeId,
  });
}

export function useVendorAnalyticsCohorts(storeId: string, monthsBack = 6) {
  return useQuery({
    queryKey: ["va-cohorts", storeId, monthsBack],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_analytics_cohorts", {
        p_store_id: storeId,
        p_months_back: monthsBack,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        cohort_month: string; customers: number; ltv: number;
        retention_d30_pct: number; retention_d60_pct: number; retention_d90_pct: number;
      }>;
    },
    enabled: !!storeId,
  });
}

export async function fetchOrdersExport(f: AnalyticsFilters) {
  const { data, error } = await supabase.rpc("vendor_analytics_orders_export", {
    p_store_id: f.storeId,
    p_start: f.start.toISOString(),
    p_end: f.end.toISOString(),
    p_category_id: f.categoryId ?? null,
    p_city: f.city ?? null,
    p_payment_method: f.paymentMethod ?? null,
  });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, any>>;
}