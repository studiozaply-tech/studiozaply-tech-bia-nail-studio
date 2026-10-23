import { z } from "zod";
import { normalizePhone } from "./format";
import { isDateKey, isTimeKey } from "./datetime";

export const nameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Digite seu nome completo.")
      .max(120, "Nome muito longo.")
      .regex(/\p{L}/u, "Digite seu nome completo."),
  );

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Digite um telefone com DDD. Ex.: (11) 91234-5678" });
      return z.NEVER;
    }
    return phone;
  });

export const notesSchema = z
  .string()
  .max(500, "A observação pode ter até 500 caracteres.")
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

export const uuidSchema = z.uuid("Identificador inválido.");
export const isoInstantSchema = z.iso.datetime({ offset: true, message: "Horário inválido." });
export const dateKeySchema = z.string().refine(isDateKey, "Data inválida.");
export const timeKeySchema = z.string().refine(isTimeKey, "Horário inválido.");

export const publicBookingSchema = z.object({
  professionalId: uuidSchema,
  serviceId: uuidSchema,
  startsAt: isoInstantSchema,
  fullName: nameSchema,
  phone: phoneSchema,
  notes: notesSchema,
});

export type PublicBookingInput = z.input<typeof publicBookingSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo."),
  description: z
    .string()
    .max(300)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  priceCents: z.number().int().min(0, "Preço inválido.").max(10_000_000, "Preço inválido."),
  durationMinutes: z.number().int().min(5).max(720).nullable(),
  isActive: z.boolean(),
});

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
