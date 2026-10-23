import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandName } from "@/components/brand/brand-name";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
      <BrandName />
      <h1 className="font-display text-3xl font-semibold text-primary-dark">Página não encontrada</h1>
      <Button asChild size="lg">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
