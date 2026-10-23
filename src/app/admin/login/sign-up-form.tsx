"use client";

import { useActionState } from "react";
import { AlertCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { signUp, type SignUpState } from "./actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Criar nova conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para se cadastrar, peça um código de convite para quem já usa o painel.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" autoComplete="name" defaultValue={state.fullName} key={`n-${state.fullName}`} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} key={`e-${state.email}`} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="passwordConfirm">Repita a senha</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Código de convite</Label>
        <Input id="code" name="code" autoComplete="off" autoCapitalize="characters" placeholder="Ex.: ABCD-1234" required />
        <p className="text-xs text-muted-foreground">Pode digitar com ou sem hífen, em maiúsculas ou minúsculas.</p>
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <p>{state.error}</p>
        </Alert>
      )}
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        {!pending && <UserPlus />} Criar conta e entrar
      </Button>
    </form>
  );
}
