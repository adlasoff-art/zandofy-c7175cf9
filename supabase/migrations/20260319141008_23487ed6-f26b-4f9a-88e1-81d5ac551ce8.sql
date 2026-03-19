CREATE OR REPLACE FUNCTION public.get_customer_loyalty_stats(p_user_id uuid)
 RETURNS TABLE(total_orders bigint, total_spent numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*)::bigint AS total_orders,
    COALESCE(SUM(subtotal - COALESCE(discount_amount, 0)), 0)::numeric AS total_spent
  FROM public.orders
  WHERE user_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded', 'payment_failed');
$function$;