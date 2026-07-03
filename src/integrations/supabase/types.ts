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
      profiles: {
        Row: {
          country: string | null
          created_at: string
          default_anonymous: boolean
          display_name: string | null
          home_lat: number | null
          home_lng: number | null
          home_zoom: number | null
          id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          default_anonymous?: boolean
          display_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zoom?: number | null
          id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          default_anonymous?: boolean
          display_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_zoom?: number | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
