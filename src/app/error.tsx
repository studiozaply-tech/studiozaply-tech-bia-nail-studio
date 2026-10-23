"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-display text-3xl font-semibold text-primary-dark">Algo deu errado</h1>
      <p className="text-muted-foreground">Não se preocupe, nada foi salvo pela metade. Tente novamente.</p>
      <Button size="lg" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
