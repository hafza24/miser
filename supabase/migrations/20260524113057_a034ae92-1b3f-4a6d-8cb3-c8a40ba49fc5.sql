
REVOKE EXECUTE ON FUNCTION public.create_group_request(public.group_request_type,int,jsonb,text,public.mode_preference) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_group_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_group_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_group_join(uuid,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_eligible_group_requests() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_group_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.group_feature_enabled() FROM anon;
