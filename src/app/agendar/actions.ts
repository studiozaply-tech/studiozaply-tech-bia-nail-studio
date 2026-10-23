"use server";

import { createClient } from "@/lib/supabase/server";
import { addDays, isDateKey, todayKey, toDateKey } from "@/lib/datetime";
import { dbErrorCode, dbErrorMessage, GENERIC_ERROR, type ActionResult } from "@/lib/errors";
import { fieldErrors, isoInstantSchema, publicBookingSchema, uuidSchema, type PublicBookingInput } from "@/lib/validation";

export type Slot = { startsAt: string; label: string };

const STUDIO_NOT_FOUND = { ok: false as const, error: "Estúdio não encontrado." };

export async function fetchAvailableDates(professionalId: string, from: string, to: string): Promise<ActionResult<string[]>> {
  if (!uuidSchema.safeParse(professionalId).success) return STUDIO_NOT_FOUND;
  if (!isDateKey(from) || !isDateKey(to) || to < from) return { ok: false, error: "Período inválido." };
  const start = from < todayKey() ? todayKey() : from;
  const end = to > addDays(start, 62) ? addDays(start, 62) : to;
  if (end < start) return { ok: true, data: [] };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_available_dates", { p_professional_id: professionalId, p_from: start, p_to: end });
    if (error) return { ok: false, error: dbErrorMessage(error, "Não foi possível carregar o calendário.") };
    return { ok: true, data: (data ?? []).map(String) };
  } catch {
    return { ok: false, error: "Não foi possível carregar o calendário." };
  }
}

export async function fetchAvailableSlots(professionalId: string, date: string): Promise<ActionResult<Slot[]>> {
  if (!uuidSchema.safeParse(professionalId).success) return STUDIO_NOT_FOUND;
  if (!isDateKey(date)) return { ok: false, error: "Data inválida." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_available_slots", { p_professional_id: professionalId, p_date: date });
    if (error) return { ok: false, error: dbErrorMessage(error, "Não foi possível carregar os horários.") };
    return { ok: true, data: (data ?? []).map((s) => ({ startsAt: new Date(s.starts_at).toISOString(), label: s.label })) };
  } catch {
    return { ok: false, error: "Não foi possível carregar os horários." };
  }
}

/** Revalida no servidor se o horário continua livre (usado ao abrir a confirmação). */
export async function checkSlotAvailable(professionalId: string, startsAt: string): Promise<ActionResult<boolean>> {
  const parsed = isoInstantSchema.safeParse(startsAt);
  if (!parsed.success) return { ok: false, error: "Horário inválido." };
  const result = await fetchAvailableSlots(professionalId, toDateKey(parsed.data));
  if (!result.ok) return result;
  const target = new Date(parsed.data).getTime();
  return { ok: true, data: result.data.some((s) => new Date(s.startsAt).getTime() === target) };
}

export type BookingConfirmation = {
  appointmentId: string;
  serviceName: string;
  priceCents: number;
  startsAt: string;
};

/**
 * Cria a reserva. A confirmação só é devolvida depois que o banco gravou o
 * agendamento; a exclusividade do horário é garantida pela função
 * create_public_booking (lock + índice único), não pela interface.
 */
export async function createBooking(input: PublicBookingInput): Promise<ActionResult<BookingConfirmation>> {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errors)[0] ?? "Confira seus dados.", fieldErrors: errors };
  }
  const { professionalId, serviceId, startsAt, fullName, phone, notes } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_starts_at: startsAt,
      p_full_name: fullName,
      p_phone: phone,
      p_notes: notes,
    });

    if (error) {
      const code = dbErrorCode(error) ?? undefined;
      if (!code) console.error("create_public_booking", error);
      return { ok: false, error: dbErrorMessage(error), code };
    }

    const row = data?.[0];
    if (!row?.appointment_id) return { ok: false, error: GENERIC_ERROR };

    return {
      ok: true,
      data: {
        appointmentId: row.appointment_id,
        serviceName: row.service_name,
        priceCents: row.service_price_cents,
        startsAt: new Date(row.starts_at).toISOString(),
      },
    };
  } catch (e) {
    console.error("createBooking", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

