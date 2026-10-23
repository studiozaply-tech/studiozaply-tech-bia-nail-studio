import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BrandName } from "@/components/brand/brand-name";
import { SetupNotice } from "@/components/booking/setup-notice";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <div className="text-center">
        <BrandName className="text-2xl" />
        <p className="mt-2 text-muted-foreground">Painel da profissional</p>
      </div>
      <Card>
        <CardContent className="p-6">
          {hasSupabaseEnv() ? (
            <LoginForm initialError={erro === "sem-acesso" ? "Esta conta não tem acesso ao painel." : undefined} />
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
