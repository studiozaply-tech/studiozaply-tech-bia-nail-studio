import Link from "next/link";
import { ArrowRight, CalendarHeart, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandName } from "@/components/brand/brand-name";
import { ServiceCardContent, serviceCardClass } from "@/components/booking/service-card";
import { SetupNotice } from "@/components/booking/setup-notice";
import { DEFAULT_STUDIO, getActiveServices, getBusinessHours, getStudio, summarizeHours, type PublicService } from "@/lib/data/public";
import { MissingSupabaseConfigError } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let studio = DEFAULT_STUDIO;
  let services: PublicService[] = [];
  let hours: string | null = null;
  let loadError: string | null = null;

  try {
    [studio, services, hours] = await Promise.all([getStudio(), getActiveServices(), getBusinessHours().then(summarizeHours)]);
  } catch (e) {
    loadError = e instanceof MissingSupabaseConfigError ? e.message : "Atualize a página em alguns instantes.";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-28 pt-6 sm:pb-12">
      <header className="flex justify-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{studio.brand_name}</span>
      </header>

      <section className="mt-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
        <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-card text-primary shadow-md shadow-primary/10" aria-hidden>
          <CalendarHeart className="size-8" />
        </span>
        <h1>
          <BrandName name={studio.display_name} href={null} className="text-4xl tracking-[0.18em] sm:text-5xl" />
        </h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">{studio.welcome_message}</p>
        {hours && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-primary-dark">
            <Clock className="size-4" aria-hidden /> {hours}
          </p>
        )}
        <Button asChild size="lg" className="mt-8 hidden w-full max-w-xs sm:inline-flex">
          <Link href="/agendar">
            Agendar agora <ArrowRight />
          </Link>
        </Button>
      </section>

      <section className="mt-12" aria-labelledby="servicos">
        <h2 id="servicos" className="mb-4 font-display text-2xl font-semibold text-primary-dark">
          Serviços
        </h2>
        {loadError ? (
          <SetupNotice message={loadError} />
        ) : services.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground">Nenhum serviço disponível no momento.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <Link href={`/agendar?servico=${s.id}`} className={serviceCardClass} aria-label={`Agendar ${s.name}`}>
                  <ServiceCardContent name={s.name} description={s.description} priceCents={s.price_cents} actionLabel="Agendar" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 flex justify-center">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-primary"
        >
          <Lock className="size-3.5" aria-hidden /> Área da profissional
        </Link>
      </footer>

      {/* Botão fixo no celular: sempre ao alcance do polegar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/90 p-4 backdrop-blur sm:hidden">
        <Button asChild size="xl">
          <Link href="/agendar">
            Agendar agora <ArrowRight />
          </Link>
        </Button>
      </div>
    </main>
  );
}
