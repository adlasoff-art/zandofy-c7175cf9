REVOKE EXECUTE ON FUNCTION public.compute_kyb_completeness(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_kyc_completeness(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refresh_kyb_completeness() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refresh_kyc_completeness() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.compute_kyb_completeness(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_kyc_completeness(UUID) TO authenticated, service_role;