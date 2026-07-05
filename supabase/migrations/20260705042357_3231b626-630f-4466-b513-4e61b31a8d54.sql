
ALTER VIEW public.reporter_leaderboard SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.autoverify_moderator() FROM PUBLIC, anon, authenticated;
