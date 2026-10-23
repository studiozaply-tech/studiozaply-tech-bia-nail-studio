"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp, type LoginState } from "./actions";

function Messages({ state }: { state: LoginState }) {
  return (
    <>
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <p>{state.error}</p>
        </Alert>
      )}
      {state.notice && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <p>{state.notice}</p>
        </Alert>
      )}
    </>
  );
}

function SignInForm({ initialError, initialNotice }: { initialError?: string; initialNotice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {
    error: initialError,
    notice: initialNotice,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} key={state.email} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Messages state={state} />
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        {!pending && <LogIn />} Entrar
      </Button>
    </form>
  );
}

function SignUpForm({ firstAccess }: { firstAccess: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signUp, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {firstAccess
          ? "Primeiro acesso: a conta criada aqui vira a administradora do painel."
          : "Use o e-mail que foi liberado em Configurações > Acessos ao painel."}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="su-name">Nome</Label>
        <Input id="su-name" name="fullName" autoComplete="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="su-email">E-mail</Label>
        <Input id="su-email" name="email" type="email" autoComplete="email" defaultValue={state.email} key={state.email} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="su-password">Senha</Label>
        <Input id="su-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
      </div>
      <Messages state={state} />
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        {!pending && <UserPlus />} Criar acesso
      </Button>
    </form>
  );
}

export function LoginForm({
  initialError,
  initialNotice,
  firstAccess,
}: {
  initialError?: string;
  initialNotice?: string;
  firstAccess: boolean;
}) {
  return (
    <Tabs defaultValue={firstAccess ? "criar" : "entrar"}>
      <TabsList className="sm:w-full">
        <TabsTrigger value="entrar">Entrar</TabsTrigger>
        <TabsTrigger value="criar">Criar acesso</TabsTrigger>
      </TabsList>
      <TabsContent value="entrar">
        <SignInForm initialError={initialError} initialNotice={initialNotice} />
      </TabsContent>
      <TabsContent value="criar">
        <SignUpForm firstAccess={firstAccess} />
      </TabsContent>
    </Tabs>
  );
}
