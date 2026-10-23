// Projeto Supabase de produção. URL e chave publicável são públicas por natureza
// (vão para o navegador de qualquer forma); servem de padrão quando as variáveis
// de ambiente não foram configuradas na hospedagem. Nunca coloque a service_role aqui.
const DEFAULT_SUPABASE_URL = "https://avifwwaeqfnfedycmolw.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iU0OawzYA_qIp3NdKToLDA_cR6uXXuj";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new MissingSupabaseConfigError();
  }
  return { url, key };
}

export function hasSupabaseEnv() {
  try {
    getSupabaseEnv();
    return true;
  } catch {
    return false;
  }
}

export class MissingSupabaseConfigError extends Error {
  constructor() {
    super("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local");
    this.name = "MissingSupabaseConfigError";
  }
}
