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
      profiles: {
        Row: {
          age_verified: boolean
          alias: string
          availability: string | null
          bio: string | null
          created_at: string
          desktop_notifications_enabled: boolean
          email: string | null
          emoji_avatar: string
          id: string
          interests: string[] | null
          is_suspended: boolean
          mode_preference: Database["public"]["Enums"]["mode_preference"]
          mood_preference: string | null
          notification_sound_enabled: boolean
          region: string | null
          updated_at: string
          user_id: string
          violation_count: number
        }
        Insert: {
          age_verified?: boolean
          alias: string
          availability?: string | null
          bio?: string | null
          created_at?: string
          desktop_notifications_enabled?: boolean
          email?: string | null
          emoji_avatar?: string
          id?: string
          interests?: string[] | null
          is_suspended?: boolean
          mode_preference?: Database["public"]["Enums"]["mode_preference"]
          mood_preference?: string | null
          notification_sound_enabled?: boolean
          region?: string | null
          updated_at?: string
          user_id: string
          violation_count?: number
        }
        Update: {
          age_verified?: boolean
          alias?: string
          availability?: string | null
          bio?: string | null
          created_at?: string
          desktop_notifications_enabled?: boolean
          email?: string | null
          emoji_avatar?: string
          id?: string
          interests?: string[] | null
          is_suspended?: boolean
          mode_preference?: Database["public"]["Enums"]["mode_preference"]
          mood_preference?: string | null
          notification_sound_enabled?: boolean
          region?: string | null
          updated_at?: string
          user_id?: string
          violation_count?: number
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
      find_random_user: {
        Args: { p_mode: Database["public"]["Enums"]["mode_preference"] }
        Returns: string
      }
      generate_alias: { Args: never; Returns: string }
      generate_emoji_avatar: { Args: never; Returns: string }
      is_chat_participant: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      start_random_chat: {
        Args: { p_mode: Database["public"]["Enums"]["mode_preference"] }
        Returns: string
      }
    }
    Enums: {
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
      mode_preference: ["light", "dark"],
      violation_type: ["warning", "mute", "suspension"],
    },
  },
} as const
