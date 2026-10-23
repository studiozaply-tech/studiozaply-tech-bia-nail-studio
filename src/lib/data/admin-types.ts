import type { Tables } from "@/types/database";

export type AdminAppointment = Pick<
  Tables<"appointments">,
  | "id"
  | "client_id"
  | "client_name"
  | "client_phone"
  | "service_name"
  | "service_price_cents"
  | "starts_at"
  | "status"
  | "source"
  | "client_notes"
  | "internal_notes"
  | "cancellation_reason"
>;

export const ADMIN_APPOINTMENT_FIELDS =
  "id, client_id, client_name, client_phone, service_name, service_price_cents, starts_at, status, source, client_notes, internal_notes, cancellation_reason" as const;
