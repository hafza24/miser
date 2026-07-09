
-- Callable RPCs: restrict to authenticated only (revoke from PUBLIC and anon)
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'accept_chat_request(p_request_id uuid, p_mode mode_preference)',
    'admin_block_email(p_email text, p_reason text)',
    'chat_role(_user_id uuid, _chat_id uuid)',
    'check_daily_chat_limit(_user_id uuid)',
    'check_daily_group_limit(_uid uuid)',
    'check_monthly_chat_limit(_user_id uuid)',
    'check_monthly_group_limit(_uid uuid)',
    'create_group_request(p_type group_request_type, p_member_limit integer, p_gender_requirements jsonb, p_topic text, p_mode mode_preference)',
    'create_group_request_from_chat(p_chat_id uuid, p_type group_request_type, p_member_limit integer, p_gender_requirements jsonb, p_topic text, p_mode mode_preference)',
    'delete_ended_chat(p_chat_id uuid)',
    'effective_daily_chat_limit(_uid uuid)',
    'effective_daily_group_limit(_uid uuid)',
    'effective_daily_scene_limit(_uid uuid)',
    'effective_monthly_chat_limit(_uid uuid)',
    'effective_monthly_group_limit(_uid uuid)',
    'effective_monthly_scene_limit(_uid uuid)',
    'ensure_group_request_chat(p_request_id uuid)',
    'finalize_group_request_chat(p_request_id uuid)',
    'find_random_user(p_mode mode_preference)',
    'get_group_request_detail(p_request_id uuid)',
    'get_user_plan_limits(_user_id uuid)',
    'group_feature_enabled()',
    'has_active_subscription(_user_id uuid)',
    'has_role(_user_id uuid, _role app_role)',
    'invite_to_chat(p_chat_id uuid, p_user_id uuid)',
    'is_blocked(_user1 uuid, _user2 uuid)',
    'is_chat_participant(_user_id uuid, _chat_id uuid)',
    'is_group_request_participant(_user_id uuid, _request_id uuid)',
    'is_muted(_muter uuid, _other uuid)',
    'is_restricted(_restrictor uuid, _other uuid)',
    'join_group_request(p_request_id uuid)',
    'join_mood_room(p_room_id uuid)',
    'leave_chat(p_chat_id uuid)',
    'leave_group_request(p_request_id uuid)',
    'list_eligible_group_requests()',
    'list_mood_rooms()',
    'mark_media_viewed(p_message_id uuid)',
    'process_violation(_content text, _mode text)',
    'record_user_report(_reported_user_id uuid)',
    'remove_chat_member(p_chat_id uuid, p_user_id uuid)',
    'report_message(_reported_user_id uuid, _chat_id uuid, _message_id uuid, _message_content text, _reason text)',
    'respond_chat_invite(p_invite_id uuid, p_accept boolean)',
    'respond_group_join(p_participant_id uuid, p_approve boolean)',
    'start_random_chat(p_mode mode_preference)',
    'update_group_meta(p_chat_id uuid, p_name text, p_image_url text)',
    'upgrade_chat_to_group(p_chat_id uuid, p_name text)',
    'user_has_auto_translate_access(_uid uuid)',
    'user_has_dark_access(_user_id uuid)',
    'user_has_group_access(_user_id uuid)',
    'user_has_presence_access(_uid uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- Publicly-callable profile discovery helpers: keep anon access
REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_profile_by_ids(user_ids uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_ids(user_ids uuid[]) TO anon, authenticated, service_role;

-- Trigger-only functions: no client role should be able to call them directly
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'enforce_chat_invite_immutable()',
    'enforce_chat_request_immutable()',
    'enforce_chat_update_scope()',
    'enforce_message_moderation()',
    'enforce_mode_switch_request_immutable()',
    'enforce_payment_defaults()',
    'enforce_subscription_defaults()',
    'enforce_timer_stop_request_immutable()',
    'fanout_match_notifications()',
    'fanout_mention_notifications()',
    'prevent_chat_participant_self_escalation()',
    'protect_sensitive_profile_fields()',
    'reject_blocked_signup()',
    'handle_new_user()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
