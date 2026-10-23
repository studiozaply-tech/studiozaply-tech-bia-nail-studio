"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminOrNull } from "@/lib/auth";
import { addDays, weekdayOf, zonedToUtcIso, toTimeKey } from "@/lib/datetime";
import { dbErrorCode, dbErrorMessage, GENERIC_ERROR, type ActionResult } from "@/lib/errors";
import {
  dateKeySchema,
  fieldErrors,
  nameSchema,
  notesSchema,
  phoneSchema,
  serviceSchema,
  timeKeySchema,
  uuidSchema,
} from "@/lib/validation";
import type { AppointmentStatus } from "@/types/database";

const NOT_ALLOWED = { ok: false as const, error: "Sua sessão expirou. Entre novamente." };

function fail(error: { message?: string; code?: string } | null, fallback = GENERIC_ERROR): { ok: false; error: string; code?: string } {
  if (error && !dbErrorCode(error)) console.error(error);
  return { ok: false, error: dbErrorMessage(error, fallback), code: dbErrorCode(error) ?? undefined };
}

function invalid(error: z.ZodError) {
  const errors = fieldErrors(error);
  return { ok: false as const, error: Object.values(errors)[0] ?? "Confira os dados.", fieldErrors: errors };
}

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

/* ----------------------------- Agendamentos ----------------------------- */

const createAppointmentSchema = z.object({
  serviceId: uuidSchema,
  date: dateKeySchema,
  time: timeKeySchema,
  fullName: nameSchema,
  phone: phoneSchema,
  notes: notesSchema,
  status: z.enum(["pending", "confirmed"]),
  priceCents: z.number().int().min(0).max(10_000_000).nullable(),
});

export async function createAppointmentAction(input: z.input<typeof createAppointmentSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const { error } = await admin.supabase.rpc("admin_create_appointment", {
    p_service_id: v.serviceId,
    p_starts_at: zonedToUtcIso(v.date, v.time),
    p_full_name: v.fullName,
    p_phone: v.phone,
    p_notes: v.notes,
    p_status: v.status,
    p_price_cents: v.priceCents,
  });
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

const statusSchema = z.object({
  id: uuidSchema,
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
  reason: z.string().max(300).optional(),
});

export async function setAppointmentStatusAction(id: string, status: AppointmentStatus, reason?: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = statusSchema.safeParse({ id, status, reason });
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase.rpc("admin_set_appointment_status", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

const rescheduleSchema = z.object({ id: uuidSchema, date: dateKeySchema, time: timeKeySchema });

export async function rescheduleAppointmentAction(id: string, date: string, time: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = rescheduleSchema.safeParse({ id, date, time });
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase.rpc("admin_reschedule_appointment", {
    p_id: parsed.data.id,
    p_starts_at: zonedToUtcIso(parsed.data.date, parsed.data.time),
  });
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

export async function updateInternalNotesAction(id: string, notes: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = z.object({ id: uuidSchema, notes: z.string().max(1000, "Até 1000 caracteres.") }).safeParse({ id, notes });
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase
    .from("appointments")
    .update({ internal_notes: parsed.data.notes.trim() || null })
    .eq("id", parsed.data.id);
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

export type AdminSlot = { time: string; state: "free" | "taken" | "blocked" };

/** Horários configurados de um dia com a situação de cada um (para o painel). */
export async function fetchAdminDaySlots(date: string): Promise<ActionResult<AdminSlot[]>> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = dateKeySchema.safeParse(date);
  if (!parsed.success) return invalid(parsed.error);

  const from = zonedToUtcIso(parsed.data);
  const to = zonedToUtcIso(addDays(parsed.data, 1));
  const [slots, appts, blocks] = await Promise.all([
    admin.supabase
      .from("available_slots")
      .select("start_time")
      .eq("weekday", weekdayOf(parsed.data))
      .eq("is_active", true)
      .order("start_time"),
    admin.supabase.from("appointments").select("starts_at").neq("status", "cancelled").gte("starts_at", from).lt("starts_at", to),
    admin.supabase.from("schedule_blocks").select("starts_at, ends_at").lt("starts_at", to).gt("ends_at", from),
  ]);
  if (slots.error || appts.error || blocks.error) return fail(slots.error ?? appts.error ?? blocks.error);

  const taken = new Set(appts.data.map((a) => toTimeKey(a.starts_at)));
  const result = slots.data.map(({ start_time }) => {
    const time = start_time.slice(0, 5);
    const instant = new Date(zonedToUtcIso(parsed.data, time)).getTime();
    const blocked = blocks.data.some((b) => instant >= new Date(b.starts_at).getTime() && instant < new Date(b.ends_at).getTime());
    return { time, state: taken.has(time) ? "taken" : blocked ? "blocked" : "free" } as AdminSlot;
  });
  return { ok: true, data: result };
}

/* ------------------------------- Bloqueios ------------------------------- */

const blockSchema = z
  .object({
    date: dateKeySchema,
    endDate: dateKeySchema,
    allDay: z.boolean(),
    startTime: timeKeySchema.optional(),
    endTime: timeKeySchema.optional(),
    reason: z.string().max(200, "Motivo muito longo.").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.date) ctx.addIssue({ code: "custom", path: ["endDate"], message: "A data final deve ser depois da inicial." });
    if (!v.allDay) {
      if (!v.startTime || !v.endTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Informe o horário inicial e final." });
      else if (v.endTime <= v.startTime && v.date === v.endDate)
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "O horário final deve ser depois do inicial." });
    }
  });

export async function createBlockAction(input: z.input<typeof blockSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const startsAt = v.allDay ? zonedToUtcIso(v.date) : zonedToUtcIso(v.date, v.startTime);
  const endsAt = v.allDay ? zonedToUtcIso(addDays(v.endDate, 1)) : zonedToUtcIso(v.endDate, v.endTime);

  const { error } = await admin.supabase.from("schedule_blocks").insert({
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: v.allDay,
    reason: v.reason?.trim() || null,
  });
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Bloqueio inválido." };
  const { error } = await admin.supabase.from("schedule_blocks").delete().eq("id", id);
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

/* -------------------------------- Serviços ------------------------------- */

export async function saveServiceAction(id: string | null, input: z.input<typeof serviceSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const row = {
    name: v.name,
    description: v.description,
    price_cents: v.priceCents,
    duration_minutes: v.durationMinutes,
    is_active: v.isActive,
  };

  let error;
  if (id) {
    if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Serviço inválido." };
    ({ error } = await admin.supabase.from("services").update(row).eq("id", id).eq("professional_id", admin.professionalId));
  } else {
    const { data: last } = await admin.supabase
      .from("services")
      .select("sort_order")
      .eq("professional_id", admin.professionalId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await admin.supabase
      .from("services")
      .insert({ ...row, professional_id: admin.professionalId, sort_order: (last?.sort_order ?? 0) + 10 }));
  }
  if (error?.code === "23505") return { ok: false, error: "Já existe um serviço com esse nome.", fieldErrors: { name: "Nome repetido." } };
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleServiceAction(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Serviço inválido." };
  const { error } = await admin.supabase.from("services").update({ is_active: isActive }).eq("id", id).eq("professional_id", admin.professionalId);
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------ Configurações ---------------------------- */

const hoursSchema = z
  .array(
    z
      .object({
        weekday: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        openTime: timeKeySchema.nullable(),
        closeTime: timeKeySchema.nullable(),
      })
      .refine((r) => !r.isOpen || (r.openTime && r.closeTime && r.openTime < r.closeTime), {
        message: "Em dias abertos, o horário de fechamento deve ser depois da abertura.",
      }),
  )
  .length(7);

export async function saveBusinessHoursAction(rows: z.input<typeof hoursSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = hoursSchema.safeParse(rows);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase.from("business_hours").upsert(
    parsed.data.map((r) => ({
      professional_id: admin.professionalId,
      weekday: r.weekday,
      is_open: r.isOpen,
      open_time: r.isOpen ? r.openTime : null,
      close_time: r.isOpen ? r.closeTime : null,
    })),
  );
  if (error) return fail(error);
  refreshAdmin();
  revalidatePath("/", "layout");
  return { ok: true };
}

const addSlotsSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia."),
  times: z.array(timeKeySchema).min(1, "Informe pelo menos um horário."),
});

export async function addSlotsAction(input: z.input<typeof addSlotsSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = addSlotsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const rows = parsed.data.weekdays.flatMap((weekday) =>
    parsed.data.times.map((time) => ({ professional_id: admin.professionalId, weekday, start_time: time, is_active: true })),
  );
  const { error } = await admin.supabase
    .from("available_slots")
    .upsert(rows, { onConflict: "professional_id,weekday,start_time" });
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

export async function removeSlotAction(id: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Horário inválido." };
  // Remover o horário do modelo não cancela agendamentos já feitos nele.
  const { error } = await admin.supabase.from("available_slots").delete().eq("id", id);
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}

/** Substitui os horários dos dias de destino pelos horários do dia de origem. */
export async function copySlotsAction(fromWeekday: number, toWeekdays: number[]): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = z
    .object({ from: z.number().int().min(0).max(6), to: z.array(z.number().int().min(0).max(6)).min(1) })
    .safeParse({ from: fromWeekday, to: toWeekdays });
  if (!parsed.success) return { ok: false, error: "Escolha os dias de destino." };

  const targets = parsed.data.to.filter((d) => d !== parsed.data.from);
  if (!targets.length) return { ok: false, error: "Escolha os dias de destino." };

  const { data: source, error: readError } = await admin.supabase
    .from("available_slots")
    .select("start_time, is_active")
    .eq("weekday", parsed.data.from);
  if (readError) return fail(readError);

  const { error: delError } = await admin.supabase.from("available_slots").delete().in("weekday", targets);
  if (delError) return fail(delError);

  if (source.length) {
    const rows = targets.flatMap((weekday) =>
      source.map((s) => ({ professional_id: admin.professionalId, weekday, start_time: s.start_time, is_active: s.is_active })),
    );
    const { error } = await admin.supabase.from("available_slots").insert(rows);
    if (error) return fail(error);
  }
  refreshAdmin();
  return { ok: true };
}

const rulesSchema = z.object({
  minAdvanceMinutes: z.number().int().min(0).max(10080),
  bookingWindowDays: z.number().int().min(1).max(365),
  maxActiveBookingsPerPhone: z.number().int().min(1).max(20),
  welcomeMessage: z.string().max(300, "Mensagem muito longa."),
});

export async function saveBookingRulesAction(input: z.input<typeof rulesSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase
    .from("professionals")
    .update({
      min_advance_minutes: parsed.data.minAdvanceMinutes,
      booking_window_days: parsed.data.bookingWindowDays,
      max_active_bookings_per_phone: parsed.data.maxActiveBookingsPerPhone,
      welcome_message: parsed.data.welcomeMessage.trim() || null,
    })
    .eq("id", admin.professionalId);
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------- Clientes ------------------------------- */

const clientSchema = z.object({
  id: uuidSchema,
  fullName: nameSchema,
  phone: phoneSchema,
  adminNotes: z.string().max(1000, "Até 1000 caracteres."),
});

export async function updateClientAction(input: z.input<typeof clientSchema>): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return NOT_ALLOWED;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await admin.supabase
    .from("clients")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      admin_notes: parsed.data.adminNotes.trim() || null,
    })
    .eq("id", parsed.data.id);
  if (error?.code === "23505") return { ok: false, error: "Já existe outra cliente com esse telefone.", fieldErrors: { phone: "Telefone já cadastrado." } };
  if (error) return fail(error);
  refreshAdmin();
  return { ok: true };
}
