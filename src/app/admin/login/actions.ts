"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Digite um e-mail válido."),
  password: z.string().min(6, "Digite sua senha."),
});

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "E-mail ou senha incorretos.", email };

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      return { error: "Esta conta não tem acesso ao painel.", email };
    }
  } catch {
    return { error: "Não foi possível entrar agora. Tente novamente.", email };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

const FIRST_ADMIN_ERRORS: Record<string, string> = {
  ADMIN_EXISTS: "O painel já tem uma conta cadastrada. Entre com seu e-mail e senha.",
  INVALID_CODE: "Código de acesso incorreto.",
  INVALID_NAME: "Digite seu nome completo.",
  INVALID_EMAIL: "Digite um e-mail válido.",
  INVALID_PASSWORD: "A senha precisa ter pelo menos 8 caracteres.",
  EMAIL_TAKEN: "Este e-mail já está cadastrado.",
};

const firstAdminSchema = z.object({
  fullName: z.string().trim().min(2, "Digite seu nome completo."),
  email: z.email("Digite um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  code: z.string().trim().min(4, "Digite o código de acesso."),
});

export type FirstAdminState = { error?: string; fullName?: string; email?: string };

export async function createFirstAdmin(_prev: FirstAdminState, formData: FormData): Promise<FirstAdminState> {
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const keep = { fullName, email };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { ...keep, error: "As senhas não são iguais." };

  const parsed = firstAdminSchema.safeParse({ fullName, email, password, code: formData.get("code") });
  if (!parsed.success) return { ...keep, error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_first_admin", {
      p_full_name: parsed.data.fullName,
      p_email: parsed.data.email,
      p_password: parsed.data.password,
      p_code: parsed.data.code,
    });
    if (error) return { ...keep, error: FIRST_ADMIN_ERRORS[error.message.trim()] ?? "Não foi possível criar a conta agora. Tente novamente." };

    const { error: loginError } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });
    if (loginError) return { ...keep, error: "Conta criada! Agora entre com seu e-mail e senha." };
  } catch {
    return { ...keep, error: "Não foi possível criar a conta agora. Tente novamente." };
  }
  redirect("/admin");
}
