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
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          self_destruct_minutes: number | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          self_destruct_minutes?: number | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
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
          notification_sound_enabled: boolean
          payment_status: string
          region: string | null
          scheduled_deletion_at: string | null
          updated_at: string
          user_id: string
          violation_count: number
        }
        Insert: {
          age_verified?: boolean
          alias: string
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
          notification_sound_enabled?: boolean
          payment_status?: string
          region?: string | null
          scheduled_deletion_at?: string | null
          updated_at?: string
          user_id: string
          violation_count?: number
        }
        Update: {
          age_verified?: boolean
          alias?: string
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
          notification_sound_enabled?: boolean
          payment_status?: string
          region?: string | null
          scheduled_deletion_at?: string | null
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
      record_user_report: {
        Args: { _reported_user_id: string }
        Returns: undefined
      }
      start_random_chat: {
        Args: { p_mode: Database["public"]["Enums"]["mode_preference"] }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      mode_preference: ["light", "dark"],
      violation_type: ["warning", "mute", "suspension"],
    },
  },
} as const
