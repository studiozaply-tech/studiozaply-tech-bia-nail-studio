import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { BrandName } from "@/components/brand/brand-name";
import { SignUpForm } from "./sign-up-form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; cadastro?: string }> }) {
  const { erro, cadastro } = await searchParams;
  const signingUp = cadastro !== undefined;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <div className="text-center">
        <BrandName className="text-2xl" />
        <p className="mt-2 text-muted-foreground">Painel da profissional</p>
      </div>
      <Card>
        <CardContent className="p-6">
          {signingUp ? (
            <SignUpForm />
          ) : (
            <LoginForm initialError={erro === "sem-acesso" ? "Esta conta não tem acesso ao painel." : undefined} />
          )}
          <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
            {signingUp ? "Já tem conta? " : "Ainda não tem conta? "}
            <Link
              href={signingUp ? "/admin/login" : "/admin/login?cadastro"}
              className="font-semibold text-primary hover:underline"
            >
              {signingUp ? "Entrar" : "Criar nova conta"}
            </Link>
          </p>
        </CardContent>
      </Card>
      <Link href="/" className="text-center text-sm text-muted-foreground hover:text-primary">
        Voltar para o site
      </Link>
    </main>
  );
}
