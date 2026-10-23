import { Ban } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/admin/page-header";
import { BlockButton } from "@/components/admin/appointment-dialogs";
import { DeleteBlockButton } from "@/components/admin/agenda-client";
import { BookingRulesForm, BusinessHoursForm, SlotsManager } from "@/components/admin/settings-forms";
import { requireAdmin } from "@/lib/auth";
import { formatDateShort, toDateKey, toTimeKey } from "@/lib/datetime";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const { supabase } = await requireAdmin();
  const [hoursRes, slotsRes, blocksRes, proRes] = await Promise.all([
    supabase.from("business_hours").select("weekday, is_open, open_time, close_time").order("weekday"),
    supabase.from("available_slots").select("id, weekday, start_time").order("start_time"),
    supabase.from("schedule_blocks").select("id, starts_at, ends_at, all_day, reason").gt("ends_at", new Date().toISOString()).order("starts_at"),
    supabase
      .from("professionals")
      .select("min_advance_minutes, booking_window_days, max_active_bookings_per_phone, welcome_message")
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  if (hoursRes.error || slotsRes.error || blocksRes.error || proRes.error) {
    return <Alert variant="destructive">Não foi possível carregar as configurações.</Alert>;
  }

  const hours = hoursRes.data;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Configurações" description="Fuso horário: América/São Paulo" />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Horários de funcionamento</CardTitle>
            <CardDescription>Dias em que você atende e o expediente de cada um.</CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessHoursForm initial={hours} />
          </CardContent>
        </Card>

        <Card id="horarios">
          <CardHeader>
            <CardTitle>Horários disponíveis para agendamento</CardTitle>
            <CardDescription>Somente estes horários aparecem para as clientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <SlotsManager slots={slotsRes.data} hours={hours} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Bloqueios de agenda</CardTitle>
                <CardDescription>Folgas, cursos ou horários que você não quer abrir.</CardDescription>
              </div>
              <BlockButton />
            </div>
          </CardHeader>
          <CardContent>
            {blocksRes.data.length ? (
              <ul className="flex flex-col gap-2">
                {blocksRes.data.map((b) => {
                  const lastDay = toDateKey(new Date(new Date(b.ends_at).getTime() - 1));
                  const first = toDateKey(b.starts_at);
                  return (
                    <li key={b.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
                      <Ban className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold">
                          {b.all_day
                            ? first === lastDay
                              ? `${formatDateShort(first)} · dia inteiro`
                              : `${formatDateShort(first)} a ${formatDateShort(lastDay)}`
                            : `${formatDateShort(first)} · ${toTimeKey(b.starts_at)} às ${toTimeKey(b.ends_at)}`}
                        </p>
                        {b.reason && <p className="text-muted-foreground">{b.reason}</p>}
                      </div>
                      <DeleteBlockButton id={b.id} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<Ban />} title="Nenhum bloqueio futuro" />
            )}
          </CardContent>
        </Card>

        {proRes.data && (
          <Card>
            <CardHeader>
              <CardTitle>Regras do agendamento online</CardTitle>
              <CardDescription>Controle com quanta antecedência e até quando as clientes podem reservar.</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingRulesForm initial={proRes.data} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
