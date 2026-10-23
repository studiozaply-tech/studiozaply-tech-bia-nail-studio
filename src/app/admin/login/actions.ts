"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Digite um e-mail válido."),
  password: z.string().min(6, "Digite sua senha."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Digite seu nome.").max(80, "Nome muito longo."),
  email: z.email("Digite um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "Senha muito longa."),
});

export type LoginState = { error?: string; notice?: string; email?: string };

const NO_ACCESS =
  "Esta conta ainda não tem acesso ao painel. Peça para liberarem o seu e-mail em Configurações > Acessos ao painel.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error?.code === "email_not_confirmed") {
      return { error: "Confirme o seu e-mail pelo link que enviamos e tente de novo.", email };
    }
    if (error) return { error: "E-mail ou senha incorretos.", email };

    // Já é admin, é o primeiro acesso do painel ou o e-mail foi liberado.
    const fullName = data.user.user_metadata?.full_name;
    const { data: isAdmin } = await supabase.rpc("claim_admin_access", {
      p_full_name: typeof fullName === "string" ? fullName : null,
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      return { error: NO_ACCESS, email };
    }
  } catch {
    return { error: "Não foi possível entrar agora. Tente novamente.", email };
  }
  redirect("/admin");
}

export async function signUp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  try {
    const supabase = await createClient();
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${origin}/admin/login?confirmado=1`,
      },
    });
    if (error?.code === "user_already_exists") return { error: "Esse e-mail já tem conta. Use a aba Entrar.", email };
    if (error?.code === "weak_password") return { error: "Escolha uma senha mais forte.", email };
    if (error?.code === "signup_disabled") {
      return { error: "O cadastro de contas está desativado no Supabase.", email };
    }
    if (error) return { error: "Não foi possível criar a conta agora. Tente novamente.", email };

    // Supabase com confirmação de e-mail ligada: ainda não há sessão.
    if (!data.session) {
      return {
        notice: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail, confirme e depois entre aqui.`,
        email,
      };
    }

    const { data: isAdmin } = await supabase.rpc("claim_admin_access", { p_full_name: parsed.data.fullName });
    if (!isAdmin) {
      await supabase.auth.signOut();
      return { error: NO_ACCESS, email };
    }
  } catch {
    return { error: "Não foi possível criar a conta agora. Tente novamente.", email };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
