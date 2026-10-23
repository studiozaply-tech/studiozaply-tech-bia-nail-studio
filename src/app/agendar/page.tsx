import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/booking-flow";
import { SetupNotice } from "@/components/booking/setup-notice";
import { BrandName } from "@/components/brand/brand-name";
import { getActiveServices, getStudio } from "@/lib/data/public";
import { MissingSupabaseConfigError } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agendar" };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const { servico } = await searchParams;
  try {
    const [studio, services] = await Promise.all([getStudio(), getActiveServices()]);
    return (
      <main>
        <BookingFlow
          services={services}
          initialServiceId={servico}
          bookingWindowDays={studio.booking_window_days}
          displayName={studio.display_name}
        />
      </main>
    );
  } catch (e) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-5 py-8">
        <BrandName />
        <SetupNotice message={e instanceof MissingSupabaseConfigError ? e.message : undefined} />
      </main>
    );
  }
}
