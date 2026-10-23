// Tipos do banco no formato gerado por `supabase gen types typescript`.
// Após aplicar as migrations você pode regenerar com:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; role: "admin" | "staff" } & Timestamps;
        Insert: { id: string; full_name?: string; role?: "admin" | "staff" };
        Update: { full_name?: string; role?: "admin" | "staff" };
        Relationships: [];
      };
      professionals: {
        Row: {
          id: string;
          display_name: string;
          brand_name: string;
          welcome_message: string | null;
          user_id: string | null;
          min_advance_minutes: number;
          booking_window_days: number;
          max_active_bookings_per_phone: number;
          is_primary: boolean;
        } & Timestamps;
        Insert: never;
        Update: {
          display_name?: string;
          brand_name?: string;
          welcome_message?: string | null;
          min_advance_minutes?: number;
          booking_window_days?: number;
          max_active_bookings_per_phone?: number;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_cents: number;
          duration_minutes: number | null;
          is_active: boolean;
          sort_order: number;
        } & Timestamps;
        Insert: {
          name: string;
          description?: string | null;
          price_cents: number;
          duration_minutes?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          price_cents?: number;
          duration_minutes?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      clients: {
        Row: { id: string; full_name: string; phone: string; admin_notes: string | null } & Timestamps;
        Insert: { full_name: string; phone: string; admin_notes?: string | null };
        Update: { full_name?: string; phone?: string; admin_notes?: string | null };
        Relationships: [];
      };
      business_hours: {
        Row: { weekday: number; is_open: boolean; open_time: string | null; close_time: string | null; updated_at: string };
        Insert: { weekday: number; is_open: boolean; open_time?: string | null; close_time?: string | null };
        Update: { is_open?: boolean; open_time?: string | null; close_time?: string | null };
        Relationships: [];
      };
      available_slots: {
        Row: { id: string; weekday: number; start_time: string; is_active: boolean; created_at: string };
        Insert: { weekday: number; start_time: string; is_active?: boolean };
        Update: { is_active?: boolean };
        Relationships: [];
      };
      schedule_blocks: {
        Row: {
          id: string;
          starts_at: string;
          ends_at: string;
          all_day: boolean;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: { starts_at: string; ends_at: string; all_day?: boolean; reason?: string | null };
        Update: { starts_at?: string; ends_at?: string; all_day?: boolean; reason?: string | null };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          client_id: string;
          service_id: string | null;
          service_name: string;
          service_price_cents: number;
          service_duration_minutes: number | null;
          client_name: string;
          client_phone: string;
          starts_at: string;
          status: AppointmentStatus;
          source: "online" | "admin";
          client_notes: string | null;
          internal_notes: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        } & Timestamps;
        Insert: never;
        Update: { internal_notes?: string | null };
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_history: {
        Row: {
          id: number;
          appointment_id: string;
          action: "created" | "status_changed" | "rescheduled" | "updated";
          old_status: AppointmentStatus | null;
          new_status: AppointmentStatus | null;
          old_starts_at: string | null;
          new_starts_at: string | null;
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      change_log: {
        Row: {
          id: number;
          table_name: string;
          record_id: string | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          old_data: Json | null;
          new_data: Json | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_available_slots: { Args: { p_date: string }; Returns: { starts_at: string; label: string }[] };
      get_available_dates: { Args: { p_from: string; p_to: string }; Returns: string[] };
      create_public_booking: {
        Args: { p_service_id: string; p_starts_at: string; p_full_name: string; p_phone: string; p_notes?: string | null };
        Returns: {
          appointment_id: string;
          service_name: string;
          service_price_cents: number;
          starts_at: string;
          status: AppointmentStatus;
        }[];
      };
      admin_create_appointment: {
        Args: {
          p_service_id: string;
          p_starts_at: string;
          p_full_name: string;
          p_phone: string;
          p_notes?: string | null;
          p_status?: AppointmentStatus;
          p_price_cents?: number | null;
        };
        Returns: string;
      };
      admin_set_appointment_status: {
        Args: { p_id: string; p_status: AppointmentStatus; p_reason?: string | null };
        Returns: undefined;
      };
      admin_reschedule_appointment: { Args: { p_id: string; p_starts_at: string }; Returns: undefined };
    };
    Enums: { appointment_status: AppointmentStatus };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
