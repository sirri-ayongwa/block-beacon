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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          issue_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          issue_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          issue_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_moderator: boolean
          issue_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_moderator?: boolean
          issue_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_moderator?: boolean
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_photos: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          path: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          path: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_photos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_id: string
          note: string | null
          status: Database["public"]["Enums"]["issue_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_id: string
          note?: string | null
          status: Database["public"]["Enums"]["issue_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "issue_status_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_votes: {
        Row: {
          created_at: string
          issue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_votes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          acknowledged_at: string | null
          category: Database["public"]["Enums"]["issue_category"]
          created_at: string
          description: string | null
          fixed_at: string | null
          handed_off_at: string | null
          handed_off_by: string | null
          handoff_note: string | null
          id: string
          is_anonymous: boolean
          lat: number
          lng: number
          photo_path: string | null
          reporter_id: string
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          acknowledged_at?: string | null
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          fixed_at?: string | null
          handed_off_at?: string | null
          handed_off_by?: string | null
          handoff_note?: string | null
          id?: string
          is_anonymous?: boolean
          lat: number
          lng: number
          photo_path?: string | null
          reporter_id: string
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          acknowledged_at?: string | null
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          description?: string | null
          fixed_at?: string | null
          handed_off_at?: string | null
          handed_off_by?: string | null
          handoff_note?: string | null
          id?: string
          is_anonymous?: boolean
          lat?: number
          lng?: number
          photo_path?: string | null
          reporter_id?: string
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
          upvote_count?: number
        }
        Relationships: []
      }
      moderator_profiles: {
        Row: {
          community: string
          created_at: string
          gov_email: string
          id: string
          organization: string
          proof_url: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          community: string
          created_at?: string
          gov_email: string
          id: string
          organization: string
          proof_url?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          community?: string
          created_at?: string
          gov_email?: string
          id?: string
          organization?: string
          proof_url?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_path: string | null
          issue_id: string | null
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          issue_id?: string | null
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          issue_id?: string | null
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          default_anonymous: boolean
          digest_subscribed: boolean
          display_name: string | null
          home_lat: number | null
          home_lng: number | null
          home_zoom: number | null
          id: string
          preferred_language: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          default_anonymous?: boolean
          digest_subscribed?: boolean
          display_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zoom?: number | null
          id: string
          preferred_language?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          default_anonymous?: boolean
          digest_subscribed?: boolean
          display_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zoom?: number | null
          id?: string
          preferred_language?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      reporter_leaderboard: {
        Row: {
          country: string | null
          display_name: string | null
          fixed_count: number | null
          id: string | null
          report_count: number | null
          total_upvotes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
      issue_category:
        | "broken_streetlight"
        | "litter"
        | "pothole"
        | "unsafe_intersection"
        | "graffiti"
        | "damaged_sidewalk"
        | "abandoned_item"
        | "water_leak"
        | "other"
      issue_status: "open" | "acknowledged" | "fixed"
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
      app_role: ["user", "moderator", "admin"],
      issue_category: [
        "broken_streetlight",
        "litter",
        "pothole",
        "unsafe_intersection",
        "graffiti",
        "damaged_sidewalk",
        "abandoned_item",
        "water_leak",
        "other",
      ],
      issue_status: ["open", "acknowledged", "fixed"],
    },
  },
} as const
