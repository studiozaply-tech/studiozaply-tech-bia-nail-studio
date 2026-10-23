import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDays, CheckCheck, Hourglass, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AppointmentCard } from "@/components/admin/appointment-card";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { NewAppointmentButton } from "@/components/admin/appointment-dialogs";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_APPOINTMENT_FIELDS } from "@/lib/data/admin-types";
import { addDays, formatDateLong, startOfMonth, todayKey, zonedToUtcIso, addMonths } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Início" };

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const today = todayKey();
  const dayStart = zonedToUtcIso(today);
  const dayEnd = zonedToUtcIso(addDays(today, 1));
  const monthStart = zonedToUtcIso(startOfMonth(today));
  const monthEnd = zonedToUtcIso(addMonths(today, 1));
  const nowIso = new Date().toISOString();

  const [todayRes, upcomingRes, pendingRes, completedRes, servicesRes, slotsRes] = await Promise.all([
    supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS).gte("starts_at", dayStart).lt("starts_at", dayEnd).neq("status", "cancelled").order("starts_at"),
    supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS).gte("starts_at", dayEnd).in("status", ["pending", "confirmed"]).order("starts_at").limit(6),
    supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS, { count: "exact" }).eq("status", "pending").gte("starts_at", nowIso).order("starts_at").limit(10),
    supabase.from("appointments").select("service_price_cents").eq("status", "completed").gte("starts_at", monthStart).lt("starts_at", monthEnd),
    supabase.from("services").select("id, name, price_cents, is_active").order("sort_order"),
    supabase.from("available_slots").select("id", { count: "exact", head: true }),
  ]);

  const error = todayRes.error ?? upcomingRes.error ?? pendingRes.error ?? completedRes.error ?? servicesRes.error;
  if (error) {
    return <Alert variant="destructive">Não foi possível carregar o painel. Atualize a página.</Alert>;
  }

  const todayList = todayRes.data ?? [];
  const pending = pendingRes.data ?? [];
  const completed = completedRes.data ?? [];
  const upcoming = upcomingRes.data ?? [];
  const services = servicesRes.data ?? [];
  const revenue = completed.reduce((sum, a) => sum + a.service_price_cents, 0);

  const stats = [
    { label: "Hoje", value: todayList.length, icon: CalendarDays, href: `/admin/agenda?visao=dia&data=${today}` },
    { label: "Próximos", value: upcoming.length, icon: CalendarCheck, href: "/admin/agenda?visao=semana" },
    { label: "Pendentes", value: pendingRes.count ?? pending.length, icon: Hourglass, href: "#pendentes" },
    { label: "Concluídos no mês", value: completed.length, icon: CheckCheck, hint: formatPrice(revenue), href: "/admin/agenda?visao=mes" },
  ];

  return (
    <>
      <PageHeader
        title="Olá, Beatriz!"
        description={formatDateLong(today).replace(/^./, (c) => c.toUpperCase())}
        actions={<NewAppointmentButton services={services} defaultDate={today} />}
      />

      {slotsRes.count === 0 && (
        <Alert variant="warning" className="mb-6">
          <Settings aria-hidden />
          <div className="flex flex-col gap-2">
            <p className="font-semibold">As clientes ainda não veem horários para agendar.</p>
            <p>Cadastre os horários que você atende em Configurações.</p>
            <Button asChild size="sm" variant="outline" className="w-fit">
              <Link href="/admin/configuracoes">Configurar horários</Link>
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint, href }) => (
          <Link key={label} href={href} className="rounded-2xl transition-transform hover:-translate-y-0.5">
            <Card className="h-full">
              <CardContent className="flex flex-col gap-1 p-4">
                <Icon className="size-5 text-primary" aria-hidden />
                <span className="text-3xl font-bold text-primary-dark">{value}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
                {hint && <span className="text-xs font-semibold text-success">{hint}</span>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="hoje">
          <h2 id="hoje" className="mb-3 text-lg font-semibold text-primary-dark">
            Agendamentos de hoje
          </h2>
          {todayList.length ? (
            <div className="flex flex-col gap-3">
              {todayList.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarDays />} title="Nenhum atendimento hoje" />
          )}
        </section>

        <section aria-labelledby="pendentes-titulo" id="pendentes">
          <h2 id="pendentes-titulo" className="mb-3 text-lg font-semibold text-primary-dark">
            Reservas pendentes
          </h2>
          {pending.length ? (
            <div className="flex flex-col gap-3">
              {pending.map((a) => (
                <AppointmentCard key={a.id} appointment={a} showDate />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Hourglass />} title="Nenhuma reserva aguardando confirmação" />
          )}
        </section>

        <section aria-labelledby="proximos" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="proximos" className="text-lg font-semibold text-primary-dark">
              Próximos atendimentos
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/admin/agenda?visao=semana">
                Ver agenda <ArrowRight />
              </Link>
            </Button>
          </div>
          {upcoming.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {upcoming.map((a) => (
                <AppointmentCard key={a.id} appointment={a} showDate />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarCheck />} title="Nenhum atendimento futuro" />
          )}
        </section>
      </div>
    </>
  );
}
