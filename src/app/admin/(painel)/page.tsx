import Link from "next/link";
import { ChevronRight, Hourglass, Settings, CalendarCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/admin/appointment-card";
import { EmptyState } from "@/components/admin/page-header";
import { NewAppointmentButton } from "@/components/admin/appointment-dialogs";
import {
  ActivityChart,
  Avatar,
  DayTimeline,
  MiniCalendar,
  NailIllustration,
  Panel,
  PanelTitle,
  ProgressRing,
  RevenueBars,
  StatTile,
  type TimelineItem,
} from "@/components/admin/dashboard-widgets";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_APPOINTMENT_FIELDS } from "@/lib/data/admin-types";
import {
  addDays,
  addMonths,
  formatDateLong,
  formatWeekdayShort,
  startOfMonth,
  startOfWeek,
  todayKey,
  toDateKey,
  toTimeKey,
  weekdayOf,
  zonedToUtcIso,
} from "@/lib/datetime";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Início" };

function greeting() {
  const hour = Number(toTimeKey(new Date()).slice(0, 2));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const today = todayKey();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(today);
  const monthEnd = addMonths(today, 1);
  const rangeFrom = zonedToUtcIso(weekStart < monthStart ? weekStart : monthStart);
  const rangeTo = zonedToUtcIso(weekEnd > monthEnd ? weekEnd : monthEnd);
  const nowIso = new Date().toISOString();

  const [rangeRes, todayRes, upcomingRes, pendingRes, clientsRes, servicesRes, slotsRes, hoursRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("starts_at, status, service_price_cents, service_duration_minutes")
      .gte("starts_at", rangeFrom)
      .lt("starts_at", rangeTo)
      .neq("status", "cancelled"),
    supabase
      .from("appointments")
      .select(`${ADMIN_APPOINTMENT_FIELDS}, service_duration_minutes`)
      .gte("starts_at", zonedToUtcIso(today))
      .lt("starts_at", zonedToUtcIso(addDays(today, 1)))
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("id, client_name, service_name, starts_at, status")
      .gte("starts_at", nowIso)
      .in("status", ["pending", "confirmed"])
      .order("starts_at")
      .limit(5),
    supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS, { count: "exact" }).eq("status", "pending").gte("starts_at", nowIso).order("starts_at").limit(10),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("services").select("id, name, price_cents, is_active").order("sort_order"),
    supabase.from("available_slots").select("id", { count: "exact", head: true }),
    supabase.from("business_hours").select("weekday, is_open, open_time, close_time").eq("weekday", weekdayOf(today)).maybeSingle(),
  ]);

  const error = rangeRes.error ?? todayRes.error ?? upcomingRes.error ?? pendingRes.error ?? servicesRes.error;
  if (error) return <Alert variant="destructive">Não foi possível carregar o painel. Atualize a página.</Alert>;

  const range = rangeRes.data ?? [];
  const todayList = todayRes.data ?? [];
  const upcoming = upcomingRes.data ?? [];
  const pending = pendingRes.data ?? [];
  const services = servicesRes.data ?? [];

  // Semana atual (segunda a domingo)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStats = week.map((key) => {
    const list = range.filter((a) => toDateKey(a.starts_at) === key);
    return {
      key,
      label: formatWeekdayShort(key).replace(/^./, (c) => c.toUpperCase()),
      count: list.length,
      cents: list.reduce((s, a) => s + a.service_price_cents, 0),
      isToday: key === today,
    };
  });
  const weekTotal = weekStats.reduce((s, d) => s + d.cents, 0);
  const weekList = range.filter((a) => toDateKey(a.starts_at) >= weekStart && toDateKey(a.starts_at) < weekEnd);
  const received = weekList.filter((a) => a.status === "completed").reduce((s, a) => s + a.service_price_cents, 0);
  const expected = weekList.filter((a) => a.status === "pending" || a.status === "confirmed").reduce((s, a) => s + a.service_price_cents, 0);

  // Mês atual
  const monthList = range.filter((a) => toDateKey(a.starts_at) >= monthStart && toDateKey(a.starts_at) < monthEnd);
  const completed = monthList.filter((a) => a.status === "completed").length;
  const noShow = monthList.filter((a) => a.status === "no_show").length;
  const attendance = completed + noShow ? completed / (completed + noShow) : null;
  const busyDays = new Set(monthList.map((a) => toDateKey(a.starts_at)));

  // Linha do tempo de hoje
  const hours = hoursRes.data;
  const times = todayList.map((a) => toTimeKey(a.starts_at));
  const openH = hours?.is_open && hours.open_time ? Number(hours.open_time.slice(0, 2)) : 13;
  const closeH = hours?.is_open && hours.close_time ? Number(hours.close_time.slice(0, 2)) : 18;
  const fromH = Math.min(openH, ...times.map((t) => Number(t.slice(0, 2))));
  const toH = Math.max(closeH, ...times.map((t) => Number(t.slice(0, 2)) + 1));
  const timeline: TimelineItem[] = todayList.map((a) => {
    const start = toTimeKey(a.starts_at);
    const end = addMinutes(start, a.service_duration_minutes ?? 60);
    return {
      id: a.id,
      start,
      end,
      title: a.client_name,
      subtitle: `${a.service_name} · ${start}`,
      href: `/admin/agenda?visao=dia&data=${today}`,
      tone: a.status === "pending" ? "pending" : a.status === "completed" ? "done" : "confirmed",
    };
  });

  const salute = greeting();

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        {slotsRes.count === 0 && (
          <Alert variant="warning">
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

        {/* Saudação */}
        <section className="relative overflow-hidden rounded-3xl bg-card px-6 py-6 shadow-sm shadow-primary/5 sm:pr-64">
          <p className="text-sm text-muted-foreground">{salute}, Beatriz</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-[26px]">Confira sua agenda de hoje</h1>
          <p className="mt-1 text-muted-foreground">{formatDateLong(today)} · tenha um ótimo dia!</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <NewAppointmentButton services={services} defaultDate={today} />
            <Button asChild variant="outline">
              <Link href={`/admin/agenda?visao=dia&data=${today}`}>Ver o dia</Link>
            </Button>
          </div>
          <NailIllustration className="pointer-events-none absolute -bottom-2 right-4 hidden h-40 w-56 sm:block" />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coluna esquerda */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={todayList.length} label="Hoje" href={`/admin/agenda?visao=dia&data=${today}`} seed={1} />
              <StatTile value={pendingRes.count ?? pending.length} label="Pendentes" href="#pendentes" seed={2} />
              <StatTile value={clientsRes.count ?? 0} label="Clientes" href="/admin/clientes" seed={3} />
            </div>

            <Panel>
              <PanelTitle>Atividade da semana</PanelTitle>
              <ActivityChart days={weekStats} />
            </Panel>

            <Panel>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {formatPrice(weekTotal)} <span className="text-sm font-normal text-muted-foreground">esta semana</span>
                </p>
              </div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <RevenueBars days={weekStats} />
                </div>
                <div className="flex gap-5 sm:flex-col sm:gap-4">
                  <div className="flex items-center gap-2">
                    <ProgressRing value={weekTotal ? received / weekTotal : 0} size={44} stroke={5} label={`${weekTotal ? Math.round((received / weekTotal) * 100) : 0}%`} />
                    <div>
                      <p className="text-sm font-bold tabular-nums">{formatPrice(received)}</p>
                      <p className="text-[11px] text-muted-foreground">Recebido</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressRing value={weekTotal ? expected / weekTotal : 0} size={44} stroke={5} label={`${weekTotal ? Math.round((expected / weekTotal) * 100) : 0}%`} />
                    <div>
                      <p className="text-sm font-bold tabular-nums">{formatPrice(expected)}</p>
                      <p className="text-[11px] text-muted-foreground">A receber</p>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* Coluna direita */}
          <div className="flex min-w-0 flex-col gap-6">
            <Panel className="flex items-center gap-5">
              <ProgressRing
                value={attendance ?? 0}
                label={attendance === null ? "—" : `${Math.round(attendance * 100)}%`}
                sublabel="Comparecimento"
              />
              <div className="flex min-w-0 flex-col gap-2 text-sm">
                <p className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-brand-to" /> {completed} concluídos no mês
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-secondary" /> {noShow} {noShow === 1 ? "falta" : "faltas"}
                </p>
                <Link href="/admin/agenda?visao=mes" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Ver o mês <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </Panel>

            <Panel className="flex-1">
              <PanelTitle
                action={
                  <Link href="/admin/agenda?visao=semana" className="text-xs font-semibold text-primary hover:underline">
                    Ver todos
                  </Link>
                }
              >
                Próximos atendimentos
              </PanelTitle>
              {upcoming.length ? (
                <ul className="flex flex-col gap-3">
                  {upcoming.map((a) => {
                    const key = toDateKey(a.starts_at);
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/admin/agenda?visao=dia&data=${key}`}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent"
                        >
                          <Avatar name={a.client_name} className="size-10 text-sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{a.client_name}</span>
                              {a.status === "pending" && <span className="size-2 shrink-0 rounded-full bg-warning" title="Pendente" />}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {a.service_name} · {key === today ? "hoje" : formatWeekdayShort(key)} {toTimeKey(a.starts_at)}
                            </span>
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<CalendarCheck />} title="Nenhum atendimento futuro" />
              )}
            </Panel>
          </div>
        </div>

        <section id="pendentes" aria-labelledby="pendentes-titulo" className="scroll-mt-20">
          <h2 id="pendentes-titulo" className="mb-3 font-semibold text-foreground">
            Reservas pendentes
          </h2>
          {pending.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {pending.map((a) => (
                <AppointmentCard key={a.id} appointment={a} showDate />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Hourglass />} title="Nenhuma reserva aguardando confirmação" />
          )}
        </section>
      </div>

      {/* Coluna do perfil */}
      <aside className="flex min-w-0 flex-col gap-6">
        <Panel>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Avatar name="Beatriz Abreu" className="size-16 rounded-full text-lg ring-4 ring-secondary" />
              <span className="text-xs font-semibold text-foreground">Beatriz</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{salute}, Beatriz</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {todayList.length
                  ? `Você tem ${todayList.length} ${todayList.length === 1 ? "atendimento" : "atendimentos"} hoje.`
                  : "Nenhum atendimento hoje."}
                {pending.length ? ` ${pending.length} ${pending.length === 1 ? "reserva aguarda" : "reservas aguardam"} confirmação.` : ""}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href={`/admin/agenda?visao=dia&data=${today}`}
              className="inline-flex h-8 items-center rounded-full bg-brand-gradient px-4 text-xs font-semibold text-white shadow-sm"
            >
              Ver agenda
            </Link>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Minha agenda</PanelTitle>
          <MiniCalendar month={monthStart} busyDays={busyDays} />
          <div className="my-5 h-px bg-border" />
          <p className="mb-4 text-sm text-muted-foreground">Hoje</p>
          <DayTimeline from={fromH} to={toH} items={timeline} />
          {!timeline.length && <p className="mt-3 text-center text-xs text-muted-foreground">Sem atendimentos marcados para hoje.</p>}
        </Panel>
      </aside>
    </div>
  );
}
