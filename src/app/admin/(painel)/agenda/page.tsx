import Link from "next/link";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/admin/appointment-card";
import { BlockButton, NewAppointmentButton } from "@/components/admin/appointment-dialogs";
import { DeleteBlockButton, FreeSlotRow } from "@/components/admin/agenda-client";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_APPOINTMENT_FIELDS, type AdminAppointment } from "@/lib/data/admin-types";
import {
  addDays,
  addMonths,
  formatDateLong,
  formatDateShort,
  formatMonthYear,
  formatWeekdayShort,
  isDateKey,
  monthGrid,
  startOfMonth,
  startOfWeek,
  todayKey,
  toDateKey,
  toTimeKey,
  weekdayOf,
  WEEKDAY_INITIALS,
  zonedToUtcIso,
  type DateKey,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";
type Block = { id: string; starts_at: string; ends_at: string; all_day: boolean; reason: string | null };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ visao?: string; data?: string; canceladas?: string; novo?: string }> }) {
  const params = await searchParams;
  const view: View = params.visao === "semana" || params.visao === "mes" ? params.visao : "dia";
  const date: DateKey = params.data && isDateKey(params.data) ? params.data : todayKey();
  const showCancelled = params.canceladas === "1";
  const { supabase, professionalId } = await requireAdmin();

  const rangeStart = view === "dia" ? date : view === "semana" ? startOfWeek(date) : startOfMonth(date);
  const rangeEnd = view === "dia" ? addDays(date, 1) : view === "semana" ? addDays(rangeStart, 7) : addMonths(rangeStart, 1);
  const from = zonedToUtcIso(rangeStart);
  const to = zonedToUtcIso(rangeEnd);

  let apptQuery = supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS).gte("starts_at", from).lt("starts_at", to).order("starts_at");
  if (!showCancelled) apptQuery = apptQuery.neq("status", "cancelled");

  const [apptRes, blockRes, slotRes, hoursRes, servicesRes] = await Promise.all([
    apptQuery,
    supabase.from("schedule_blocks").select("id, starts_at, ends_at, all_day, reason").lt("starts_at", to).gt("ends_at", from).order("starts_at"),
    supabase.from("available_slots").select("weekday, start_time").eq("is_active", true).order("start_time"),
    supabase.from("business_hours").select("weekday, is_open, open_time, close_time").eq("professional_id", professionalId),
    supabase.from("services").select("id, name, price_cents, is_active").eq("professional_id", professionalId).order("sort_order"),
  ]);
  if (apptRes.error || blockRes.error || slotRes.error || hoursRes.error || servicesRes.error) {
    return <Alert variant="destructive">Não foi possível carregar a agenda. Atualize a página.</Alert>;
  }

  const appointments = apptRes.data;
  const blocks = blockRes.data;
  const services = servicesRes.data;
  const byDay = new Map<string, AdminAppointment[]>();
  for (const a of appointments) {
    const k = toDateKey(a.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const blocksForDay = (d: DateKey) => {
    const s = new Date(zonedToUtcIso(d)).getTime();
    const e = new Date(zonedToUtcIso(addDays(d, 1))).getTime();
    return blocks.filter((b) => new Date(b.starts_at).getTime() < e && new Date(b.ends_at).getTime() > s);
  };
  const isOpen = (d: DateKey) => hoursRes.data.find((h) => h.weekday === weekdayOf(d))?.is_open ?? false;
  const slotsFor = (d: DateKey) => {
    const h = hoursRes.data.find((x) => x.weekday === weekdayOf(d));
    return slotRes.data
      .filter((s) => s.weekday === weekdayOf(d))
      .map((s) => s.start_time.slice(0, 5))
      .filter((t) => h?.is_open && h.open_time && h.close_time && t >= h.open_time.slice(0, 5) && t < h.close_time.slice(0, 5));
  };

  const step = (n: number) => (view === "dia" ? addDays(date, n) : view === "semana" ? addDays(date, 7 * n) : addMonths(date, n));
  const href = (v: View, d: DateKey) => `/admin/agenda?visao=${v}&data=${d}${showCancelled ? "&canceladas=1" : ""}`;
  const title =
    view === "dia"
      ? formatDateLong(date)
      : view === "semana"
        ? `${formatDateShort(rangeStart).slice(0, 5)} a ${formatDateShort(addDays(rangeStart, 6)).slice(0, 5)}`
        : formatMonthYear(date);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agenda"
        actions={
          <>
            <NewAppointmentButton services={services} defaultDate={view === "dia" ? date : undefined} autoOpen={params.novo === "1"} />
            <BlockButton defaultDate={view === "dia" ? date : undefined} />
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-12 w-full items-center gap-1 rounded-xl bg-secondary p-1 sm:w-fit" role="tablist" aria-label="Visualização">
          {(
            [
              ["dia", "Dia"],
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={href(v, date)}
              role="tab"
              aria-selected={view === v}
              className={cn(
                "flex h-full flex-1 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-all",
                view === v ? "bg-card text-primary shadow-sm" : "text-secondary-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Anterior">
            <Link href={href(view, step(-1))}>
              <ChevronLeft />
            </Link>
          </Button>
          <p className="min-w-0 flex-1 text-center font-semibold first-letter:uppercase text-primary-dark sm:min-w-48">{title}</p>
          <Button asChild variant="ghost" size="icon" aria-label="Próximo">
            <Link href={href(view, step(1))}>
              <ChevronRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(view, todayKey())}>Hoje</Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <Link
          href={`/admin/agenda?visao=${view}&data=${date}${showCancelled ? "" : "&canceladas=1"}`}
          className="text-sm font-medium text-muted-foreground hover:text-primary"
        >
          {showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"}
        </Link>
      </div>

      {view === "dia" && (
        <DayView
          date={date}
          appointments={byDay.get(date) ?? []}
          blocks={blocksForDay(date)}
          slots={slotsFor(date)}
          open={isOpen(date)}
          services={services}
        />
      )}

      {view === "semana" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((d) => {
            const list = byDay.get(d) ?? [];
            const dayBlocks = blocksForDay(d);
            return (
              <section key={d} className={cn("rounded-2xl bg-card/60 p-3", d === todayKey() && "ring-2 ring-accent")}>
                <Link href={href("dia", d)} className="mb-2 flex items-center justify-between rounded-lg px-1 py-1 hover:text-primary">
                  <span className="font-semibold first-letter:uppercase text-primary-dark">
                    {formatWeekdayShort(d)} {d.slice(8)}/{d.slice(5, 7)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {!isOpen(d) ? "Fechado" : `${list.length} agend.`}
                  </span>
                </Link>
                {dayBlocks.length > 0 && (
                  <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                    <Ban className="size-3.5" aria-hidden /> Bloqueio {dayBlocks.some((b) => b.all_day) ? "o dia todo" : "parcial"}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {list.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                  {!list.length && <p className="px-1 py-2 text-sm text-muted-foreground">Sem agendamentos</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div className="rounded-2xl bg-card p-3 shadow-sm">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_INITIALS.map((d, i) => (
              <span key={i} className="pb-2 text-xs font-semibold text-muted-foreground">
                {d}
              </span>
            ))}
            {monthGrid(date).map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const list = (byDay.get(d) ?? []).filter((a) => a.status !== "cancelled");
              const pendingCount = list.filter((a) => a.status === "pending").length;
              const blocked = blocksForDay(d).length > 0;
              return (
                <Link
                  key={d}
                  href={href("dia", d)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors hover:bg-secondary sm:aspect-auto sm:h-20",
                    !isOpen(d) && "text-muted-foreground/50",
                    d === todayKey() && "ring-2 ring-accent ring-inset",
                  )}
                  aria-label={`${formatDateLong(d)}: ${list.length} agendamentos`}
                >
                  <span className="font-semibold">{Number(d.slice(8))}</span>
                  {list.length > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-bold", pendingCount ? "bg-warning-soft text-warning" : "bg-primary text-primary-foreground")}>
                      {list.length}
                    </span>
                  )}
                  {blocked && <Ban className="size-3 text-muted-foreground" aria-hidden />}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-full bg-primary" /> agendamentos
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-3 rounded-full bg-warning-soft ring-1 ring-warning" /> com pendentes
            </span>
            <span className="inline-flex items-center gap-1">
              <Ban className="size-3" /> bloqueio
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function DayView({
  date,
  appointments,
  blocks,
  slots,
  open,
  services,
}: {
  date: DateKey;
  appointments: AdminAppointment[];
  blocks: Block[];
  slots: string[];
  open: boolean;
  services: { id: string; name: string; price_cents: number; is_active: boolean }[];
}) {
  const isBlocked = (time: string) => {
    const t = new Date(zonedToUtcIso(date, time)).getTime();
    return blocks.some((b) => t >= new Date(b.starts_at).getTime() && t < new Date(b.ends_at).getTime());
  };
  const isPast = (time: string) => new Date(zonedToUtcIso(date, time)).getTime() < Date.now();
  const takenTimes = new Set(appointments.filter((a) => a.status !== "cancelled").map((a) => toTimeKey(a.starts_at)));

  type Row = { time: string; kind: "appt"; appt: AdminAppointment } | { time: string; kind: "free" | "blocked" };
  const rows: Row[] = [
    ...appointments.map((a) => ({ time: toTimeKey(a.starts_at), kind: "appt" as const, appt: a })),
    ...slots
      .filter((t) => !takenTimes.has(t) && !isPast(t))
      .map((t) => ({ time: t, kind: isBlocked(t) ? ("blocked" as const) : ("free" as const) })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
          <Ban className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              {b.all_day
                ? toDateKey(b.starts_at) === toDateKey(new Date(new Date(b.ends_at).getTime() - 1))
                  ? "Dia bloqueado"
                  : `Bloqueado de ${formatDateShort(toDateKey(b.starts_at))} a ${formatDateShort(toDateKey(new Date(new Date(b.ends_at).getTime() - 1)))}`
                : `Bloqueado das ${toTimeKey(b.starts_at)} às ${toTimeKey(b.ends_at)}`}
            </p>
            {b.reason && <p className="text-muted-foreground">{b.reason}</p>}
          </div>
          <DeleteBlockButton id={b.id} />
        </div>
      ))}

      {!open && (
        <EmptyState icon={<Moon />} title="Dia fechado">
          Você pode criar um agendamento mesmo assim pelo botão “Novo agendamento”.
        </EmptyState>
      )}

      {open && rows.length === 0 && (
        <EmptyState icon={<CalendarDays />} title="Nenhum agendamento">
          {slots.length === 0 ? (
            <>
              Nenhum horário configurado para este dia. <Link className="font-semibold text-primary underline" href="/admin/configuracoes">Configurar horários</Link>
            </>
          ) : null}
        </EmptyState>
      )}

      {rows.map((r) =>
        r.kind === "appt" ? (
          <AppointmentCard key={r.appt.id} appointment={r.appt} />
        ) : r.kind === "free" ? (
          <FreeSlotRow key={`f${r.time}`} services={services} date={date} time={r.time} />
        ) : (
          <div key={`b${r.time}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 text-muted-foreground">
            <span className="flex min-w-16 justify-center rounded-xl bg-muted px-2 py-2 text-lg font-bold line-through">{r.time}</span>
            Bloqueado
          </div>
        ),
      )}
    </div>
  );
}
