import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type PublicService = Pick<Tables<"services">, "id" | "name" | "description" | "price_cents">;
export type Studio = Pick<
  Tables<"professionals">,
  "id" | "slug" | "display_name" | "brand_name" | "welcome_message" | "booking_window_days" | "is_primary"
>;

/** Estúdio pelo link (/p/<slug>) ou, sem link, o estúdio principal. null quando não existe. */
export async function getStudio(slug?: string): Promise<Studio | null> {
  const supabase = await createClient();
  let query = supabase
    .from("professionals")
    .select("id, slug, display_name, brand_name, welcome_message, booking_window_days, is_primary");
  query = slug ? query.eq("slug", slug) : query.eq("is_primary", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/** Caminho base das páginas públicas do estúdio. */
export function studioBasePath(studio: Pick<Studio, "slug" | "is_primary">) {
  return studio.is_primary ? "" : `/p/${studio.slug}`;
}

export async function getActiveServices(professionalId: string): Promise<PublicService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price_cents")
    .eq("professional_id", professionalId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getBusinessHours(professionalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_hours")
    .select("weekday, is_open, open_time, close_time")
    .eq("professional_id", professionalId)
    .order("weekday");
  if (error) throw error;
  return data ?? [];
}

/** Resume o expediente, ex.: "Segunda a sábado · 13h às 18h". */
export function summarizeHours(rows: Awaited<ReturnType<typeof getBusinessHours>>) {
  const open = rows.filter((r) => r.is_open && r.open_time && r.close_time);
  if (!open.length) return null;
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
  };
  const sameHours = open.every((r) => r.open_time === open[0].open_time && r.close_time === open[0].close_time);
  const days = open.map((r) => r.weekday);
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    contiguous && days.length > 2
      ? `${names[days[0]]} a ${names[days[days.length - 1]]}`
      : days.map((d) => names[d]).join(", ");
  const label = dayText.charAt(0).toUpperCase() + dayText.slice(1);
  return sameHours ? `${label} · ${fmt(open[0].open_time!)} às ${fmt(open[0].close_time!)}` : label;
}
