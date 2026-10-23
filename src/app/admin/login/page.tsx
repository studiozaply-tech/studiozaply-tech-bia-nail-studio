import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BrandName } from "@/components/brand/brand-name";
import { SetupNotice } from "@/components/booking/setup-notice";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

async function hasAdmin() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_exists");
    return error ? true : data;
  } catch {
    return true;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; confirmado?: string }> }) {
  const { erro, confirmado } = await searchParams;
  const configured = hasSupabaseEnv();
  const firstAccess = configured && !(await hasAdmin());
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <div className="text-center">
        <BrandName className="text-2xl" />
        <p className="mt-2 text-muted-foreground">Painel da profissional</p>
      </div>
      <Card>
        <CardContent className="p-6">
          {configured ? (
            <LoginForm
              firstAccess={firstAccess}
              initialError={erro === "sem-acesso" ? "Esta conta não tem acesso ao painel." : undefined}
              initialNotice={confirmado ? "E-mail confirmado. Agora entre com seu e-mail e senha." : undefined}
            />
          ) : (
            <SetupNotice message="Configure as variáveis do Supabase no arquivo .env.local para usar o painel." />
          )}
        </CardContent>
      </Card>
      <Link href="/" className="text-center text-sm text-muted-foreground hover:text-primary">
        Voltar para o site
      </Link>
    </main>
  );
}
