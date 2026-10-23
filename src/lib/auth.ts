import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Usuária autenticada e dona de um estúdio; caso contrário redireciona para o login.
 * professionalId é o estúdio dela: o banco só deixa ler e alterar dados desse estúdio.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: professionalId, error } = await supabase.rpc("current_professional_id");
  if (error || !professionalId) redirect("/admin/login?erro=sem-acesso");

  return { supabase, user, professionalId };
});

/** Para Server Actions: não redireciona, devolve null quando não autorizado. */
export async function getAdminOrNull() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: professionalId } = await supabase.rpc("current_professional_id");
  return professionalId ? { supabase, user, professionalId } : null;
}

/** Dados do estúdio da usuária logada (nome e link público). */
export const getMyStudio = cache(async () => {
  const { supabase, professionalId } = await requireAdmin();
  const { data } = await supabase
    .from("professionals")
    .select("display_name, brand_name, slug, is_primary")
    .eq("id", professionalId)
    .maybeSingle();
  const fullName = (data?.display_name ?? "")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)\p{L}/gu, (c) => c.toLocaleUpperCase("pt-BR"));
  return {
    displayName: data?.display_name ?? "",
    firstName: fullName.split(" ")[0] ?? "",
    fullName,
    publicPath: data && !data.is_primary ? `/p/${data.slug}` : "/",
  };
});
