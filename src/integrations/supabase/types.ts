export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_participants: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_group: boolean
          mode: Database["public"]["Enums"]["mode_preference"]
          timer_stopped: boolean
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_group?: boolean
          mode?: Database["public"]["Enums"]["mode_preference"]
          timer_stopped?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_group?: boolean
          mode?: Database["public"]["Enums"]["mode_preference"]
          timer_stopped?: boolean
        }
        Relationships: []
      }
      group_participants: {
        Row: {
          gender_slot: string | null
          id: string
          join_status: Database["public"]["Enums"]["group_join_status"]
          joined_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          gender_slot?: string | null
          id?: string
          join_status?: Database["public"]["Enums"]["group_join_status"]
          joined_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          gender_slot?: string | null
          id?: string
          join_status?: Database["public"]["Enums"]["group_join_status"]
          joined_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_participants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "group_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      group_requests: {
        Row: {
          admin_note: string | null
          ai_icebreakers: string[] | null
          ai_scene_description: string | null
          ai_scene_title: string | null
          chat_id: string | null
          created_at: string
          creator_id: string
          expires_at: string
          gender_requirements: Json
          id: string
          member_limit: number
          mode: Database["public"]["Enums"]["mode_preference"]
          mood_tags: string[] | null
          status: Database["public"]["Enums"]["group_request_status"]
          topic: string
          type: Database["public"]["Enums"]["group_request_type"]
        }
        Insert: {
          admin_note?: string | null
          ai_icebreakers?: string[] | null
          ai_scene_description?: string | null
          ai_scene_title?: string | null
          chat_id?: string | null
          created_at?: string
          creator_id: string
          expires_at?: string
          gender_requirements?: Json
          id?: string
          member_limit: number
          mode?: Database["public"]["Enums"]["mode_preference"]
          mood_tags?: string[] | null
          status?: Database["public"]["Enums"]["group_request_status"]
          topic: string
          type: Database["public"]["Enums"]["group_request_type"]
        }
        Update: {
          admin_note?: string | null
          ai_icebreakers?: string[] | null
          ai_scene_description?: string | null
          ai_scene_title?: string | null
          chat_id?: string | null
          created_at?: string
          creator_id?: string
          expires_at?: string
          gender_requirements?: Json
          id?: string
          member_limit?: number
          mode?: Database["public"]["Enums"]["mode_preference"]
          mood_tags?: string[] | null
          status?: Database["public"]["Enums"]["group_request_status"]
          topic?: string
          type?: Database["public"]["Enums"]["group_request_type"]
        }
        Relationships: []
      }
      message_reports: {
        Row: {
          admin_note: string | null
          chat_id: string | null
          created_at: string
          id: string
          message_content: string | null
          message_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          status: string
          unique_key: string | null
        }
        Insert: {
          admin_note?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          message_content?: string | null
          message_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          unique_key?: string | null
        }
        Update: {
          admin_note?: string | null
          chat_id?: string | null
          created_at?: string
          id?: string
          message_content?: string | null
          message_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          unique_key?: string | null
        }
        Relationships: []
      }
      message_translations: {
        Row: {
          created_at: string
          detected_language: string | null
          id: string
          message_id: string
          status: string
          target_language: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          detected_language?: string | null
          id?: string
          message_id: string
          status?: string
          target_language: string
          translated_text: string
        }
        Update: {
          created_at?: string
          detected_language?: string | null
          id?: string
          message_id?: string
          status?: string
          target_language?: string
          translated_text?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          reply_to: string | null
          self_destruct_minutes: number | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          reply_to?: string | null
          self_destruct_minutes?: number | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          reply_to?: string | null
          self_destruct_minutes?: number | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mode_switch_requests: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          sender_id: string
          status: string
          target_mode: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
          status?: string
          target_mode?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
          target_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "mode_switch_requests_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          created_at: string
          id: string
          message_text: string | null
          user_id: string
          violation_type: Database["public"]["Enums"]["violation_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message_text?: string | null
          user_id: string
          violation_type: Database["public"]["Enums"]["violation_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message_text?: string | null
          user_id?: string
          violation_type?: Database["public"]["Enums"]["violation_type"]
        }
        Relationships: []
      }
      payment_info: {
        Row: {
          account_holder: string
          account_number: string
          created_at: string
          id: string
          is_active: boolean
          method_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          created_at?: string
          id?: string
          is_active?: boolean
          method_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          created_at?: string
          id?: string
          is_active?: boolean
          method_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          method: string
          name: string
          reviewed_at: string | null
          screenshot_url: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          method: string
          name: string
          reviewed_at?: string | null
          screenshot_url?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          method?: string
          name?: string
          reviewed_at?: string | null
          screenshot_url?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          proof_url: string | null
          reviewed_at: string | null
          status: string
          subscription_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method: string
          proof_url?: string | null
          reviewed_at?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          proof_url?: string | null
          reviewed_at?: string | null
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_verified: boolean
          alias: string
          alias_changed_at: string | null
          auto_translate_enabled: boolean
          availability: string | null
          bio: string | null
          character_description: string | null
          character_life_story: string | null
          character_personality: string[] | null
          character_title: string | null
          created_at: string
          daily_chat_limit: number
          daily_scene_limit: number
          dark_mode_blocked: boolean
          desktop_notifications_enabled: boolean
          email: string | null
          emoji_avatar: string
          gender: string | null
          id: string
          interests: string[] | null
          is_online: boolean
          is_suspended: boolean
          last_seen_at: string | null
          light_mode_blocked: boolean
          mode_preference: Database["public"]["Enums"]["mode_preference"]
          mood_preference: string | null
          muted_until: string | null
          notification_sound_enabled: boolean
          payment_status: string
          primary_language: string
          receive_group_invites: boolean
          region: string | null
          scheduled_deletion_at: string | null
          secondary_language: string | null
          updated_at: string
          user_id: string
          violation_count: number
        }
        Insert: {
          age_verified?: boolean
          alias: string
          alias_changed_at?: string | null
          auto_translate_enabled?: boolean
          availability?: string | null
          bio?: string | null
          character_description?: string | null
          character_life_story?: string | null
          character_personality?: string[] | null
          character_title?: string | null
          created_at?: string
          daily_chat_limit?: number
          daily_scene_limit?: number
          dark_mode_blocked?: boolean
          desktop_notifications_enabled?: boolean
          email?: string | null
          emoji_avatar?: string
          gender?: string | null
          id?: string
          interests?: string[] | null
          is_online?: boolean
          is_suspended?: boolean
          last_seen_at?: string | null
          light_mode_blocked?: boolean
          mode_preference?: Database["public"]["Enums"]["mode_preference"]
          mood_preference?: string | null
          muted_until?: string | null
          notification_sound_enabled?: boolean
          payment_status?: string
          primary_language?: string
          receive_group_invites?: boolean
          region?: string | null
          scheduled_deletion_at?: string | null
          secondary_language?: string | null
          updated_at?: string
          user_id: string
          violation_count?: number
        }
        Update: {
          age_verified?: boolean
          alias?: string
          alias_changed_at?: string | null
          auto_translate_enabled?: boolean
          availability?: string | null
          bio?: string | null
          character_description?: string | null
          character_life_story?: string | null
          character_personality?: string[] | null
          character_title?: string | null
          created_at?: string
          daily_chat_limit?: number
          daily_scene_limit?: number
          dark_mode_blocked?: boolean
          desktop_notifications_enabled?: boolean
          email?: string | null
          emoji_avatar?: string
          gender?: string | null
          id?: string
          interests?: string[] | null
          is_online?: boolean
          is_suspended?: boolean
          last_seen_at?: string | null
          light_mode_blocked?: boolean
          mode_preference?: Database["public"]["Enums"]["mode_preference"]
          mood_preference?: string | null
          muted_until?: string | null
          notification_sound_enabled?: boolean
          payment_status?: string
          primary_language?: string
          receive_group_invites?: boolean
          region?: string | null
          scheduled_deletion_at?: string | null
          secondary_language?: string | null
          updated_at?: string
          user_id?: string
          violation_count?: number
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          daily_chat_limit: number
          daily_scene_limit: number
          dark_mode_access: boolean
          description: string | null
          group_requests_access: boolean
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_chat_limit?: number
          daily_scene_limit?: number
          dark_mode_access?: boolean
          description?: string | null
          group_requests_access?: boolean
          id?: string
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_chat_limit?: number
          daily_scene_limit?: number
          dark_mode_access?: boolean
          description?: string | null
          group_requests_access?: boolean
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          billing_period: string
          created_at: string
          expiry_date: string
          id: string
          plan_id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          billing_period?: string
          created_at?: string
          expiry_date: string
          id?: string
          plan_id: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          billing_period?: string
          created_at?: string
          expiry_date?: string
          id?: string
          plan_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          replied_at: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      timer_stop_requests: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          sender_id: string
          status: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          sender_id: string
          status?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "timer_stop_requests_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_chat_request: {
        Args: {
          p_mode?: Database["public"]["Enums"]["mode_preference"]
          p_request_id: string
        }
        Returns: string
      }
      check_daily_chat_limit: { Args: { _user_id: string }; Returns: boolean }
      create_group_request: {
        Args: {
          p_gender_requirements: Json
          p_member_limit: number
          p_mode?: Database["public"]["Enums"]["mode_preference"]
          p_topic: string
          p_type: Database["public"]["Enums"]["group_request_type"]
        }
        Returns: string
      }
      find_random_user: {
        Args: { p_mode: Database["public"]["Enums"]["mode_preference"] }
        Returns: string
      }
      generate_alias: { Args: never; Returns: string }
      generate_emoji_avatar: { Args: never; Returns: string }
      get_public_profile_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          alias: string
          emoji_avatar: string
          user_id: string
        }[]
      }
      get_public_profiles: {
        Args: never
        Returns: {
          alias: string
          availability: string
          bio: string
          character_description: string
          character_life_story: string
          character_personality: string[]
          character_title: string
          emoji_avatar: string
          gender: string
          interests: string[]
          is_online: boolean
          last_seen_at: string
          mode_preference: Database["public"]["Enums"]["mode_preference"]
          mood_preference: string
          region: string
          user_id: string
        }[]
      }
      get_user_plan_limits: {
        Args: { _user_id: string }
        Returns: {
          daily_chat_limit: number
          daily_scene_limit: number
          dark_mode_access: boolean
          plan_name: string
        }[]
      }
      group_feature_enabled: { Args: never; Returns: boolean }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _user1: string; _user2: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_request: { Args: { p_request_id: string }; Returns: string }
      leave_group_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      list_eligible_group_requests: {
        Args: never
        Returns: {
          admin_note: string | null
          ai_icebreakers: string[] | null
          ai_scene_description: string | null
          ai_scene_title: string | null
          chat_id: string | null
          created_at: string
          creator_id: string
          expires_at: string
          gender_requirements: Json
          id: string
          member_limit: number
          mode: Database["public"]["Enums"]["mode_preference"]
          mood_tags: string[] | null
          status: Database["public"]["Enums"]["group_request_status"]
          topic: string
          type: Database["public"]["Enums"]["group_request_type"]
        }[]
        SetofOptions: {
          from: "*"
          to: "group_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      process_violation: {
        Args: { _content: string; _mode?: string }
        Returns: Json
      }
      record_user_report: {
        Args: { _reported_user_id: string }
        Returns: undefined
      }
      report_message: {
        Args: {
          _chat_id: string
          _message_content: string
          _message_id: string
          _reason: string
          _reported_user_id: string
        }
        Returns: string
      }
      respond_group_join: {
        Args: { p_approve: boolean; p_participant_id: string }
        Returns: undefined
      }
      start_random_chat: {
        Args: { p_mode: Database["public"]["Enums"]["mode_preference"] }
        Returns: string
      }
      user_has_dark_access: { Args: { _user_id: string }; Returns: boolean }
      user_has_group_access: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      group_join_status: "pending" | "approved" | "rejected" | "left"
      group_request_status:
        | "pending_review"
        | "open"
        | "filled"
        | "closed"
        | "rejected"
      group_request_type: "threesome" | "circle"
      mode_preference: "light" | "dark"
      violation_type: "warning" | "mute" | "suspension"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      group_join_status: ["pending", "approved", "rejected", "left"],
      group_request_status: [
        "pending_review",
        "open",
        "filled",
        "closed",
        "rejected",
      ],
      group_request_type: ["threesome", "circle"],
      mode_preference: ["light", "dark"],
      violation_type: ["warning", "mute", "suspension"],
    },
  },
} as const
