"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert } from "@/components/ui/alert";
import {
  addSlotsAction,
  copySlotsAction,
  removeSlotAction,
  saveBookingRulesAction,
  saveBusinessHoursAction,
} from "@/app/admin/actions";
import { WEEKDAY_NAMES } from "@/lib/datetime";
import { cn } from "@/lib/utils";

// Ordem de exibição: segunda a domingo
const DAYS = [1, 2, 3, 4, 5, 6, 0];

type HoursRow = { weekday: number; is_open: boolean; open_time: string | null; close_time: string | null };

/* ------------------------- Horários de funcionamento ------------------------ */

export function BusinessHoursForm({ initial }: { initial: HoursRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    DAYS.map((weekday) => {
      const r = initial.find((x) => x.weekday === weekday);
      return {
        weekday,
        isOpen: r?.is_open ?? false,
        openTime: r?.open_time?.slice(0, 5) ?? "13:00",
        closeTime: r?.close_time?.slice(0, 5) ?? "18:00",
      };
    }),
  );
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const update = (weekday: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  const save = () =>
    start(async () => {
      const res = await saveBusinessHoursAction(
        rows.map((r) => ({ weekday: r.weekday, isOpen: r.isOpen, openTime: r.isOpen ? r.openTime : null, closeTime: r.isOpen ? r.closeTime : null })),
      );
      if (!res.ok) return setError(res.error);
      setError(undefined);
      toast.success("Horários de funcionamento salvos.");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.weekday} className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
          <label className="flex min-w-36 flex-1 items-center gap-3">
            <Switch checked={r.isOpen} onCheckedChange={(v) => update(r.weekday, { isOpen: v })} aria-label={`Aberto ${WEEKDAY_NAMES[r.weekday]}`} />
            <span className="font-semibold">{WEEKDAY_NAMES[r.weekday]}</span>
          </label>
          {r.isOpen ? (
            <div className="flex items-center gap-2">
              <Input type="time" value={r.openTime} onChange={(e) => update(r.weekday, { openTime: e.target.value })} className="h-10 w-28" aria-label={`Abre ${WEEKDAY_NAMES[r.weekday]}`} />
              <span className="text-sm text-muted-foreground">às</span>
              <Input type="time" value={r.closeTime} onChange={(e) => update(r.weekday, { closeTime: e.target.value })} className="h-10 w-28" aria-label={`Fecha ${WEEKDAY_NAMES[r.weekday]}`} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Fechado</span>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} loading={pending} className="mt-2 w-full sm:w-fit">
        Salvar funcionamento
      </Button>
    </div>
  );
}

/* --------------------------- Horários disponíveis --------------------------- */

type SlotRow = { id: string; weekday: number; start_time: string };

export function SlotsManager({ slots, hours }: { slots: SlotRow[]; hours: HoursRow[] }) {
  const router = useRouter();
  const openDays = DAYS.filter((d) => hours.find((h) => h.weekday === d)?.is_open);
  const [time, setTime] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>(openDays);
  const [copyFrom, setCopyFrom] = useState<number>(openDays[0] ?? 1);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setError(undefined);
      toast.success(success);
      router.refresh();
    });

  const outside = (weekday: number, t: string) => {
    const h = hours.find((x) => x.weekday === weekday);
    if (!h?.is_open || !h.open_time || !h.close_time) return true;
    return t < h.open_time.slice(0, 5) || t >= h.close_time.slice(0, 5);
  };

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="info">
        <p>
          Cadastre os horários de <strong>início</strong> que as clientes podem escolher. Como cada atendimento tem uma duração diferente,
          deixe o espaço que você precisa entre eles. Nada é criado automaticamente.
        </p>
      </Alert>

      <form
        className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!time) return setError("Escolha um horário.");
          run(() => addSlotsAction({ weekdays: selectedDays, times: [time] }), `Horário ${time} adicionado.`);
        }}
      >
        <Label htmlFor="slot-time">Adicionar horário</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Dias">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={selectedDays.includes(d)}
              onClick={() => setSelectedDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}
              className={cn(
                "h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold transition-colors",
                selectedDays.includes(d) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              )}
            >
              {WEEKDAY_NAMES[d].slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input id="slot-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
          <Button type="submit" loading={pending} disabled={!selectedDays.length}>
            {!pending && <Plus />} Adicionar
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <div className="flex flex-col gap-3">
        {DAYS.map((d) => {
          const daySlots = slots.filter((s) => s.weekday === d);
          const closed = !hours.find((h) => h.weekday === d)?.is_open;
          return (
            <div key={d} className={cn("rounded-2xl bg-secondary/60 p-3", closed && "opacity-60")}>
              <p className="mb-2 font-semibold">
                {WEEKDAY_NAMES[d]} {closed && <span className="font-normal text-muted-foreground">· fechado</span>}
              </p>
              {daySlots.length ? (
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => {
                    const t = s.start_time.slice(0, 5);
                    return (
                      <span
                        key={s.id}
                        className={cn(
                          "inline-flex h-10 items-center gap-1 rounded-xl bg-card pl-3 pr-1 font-semibold",
                          outside(d, t) && "text-muted-foreground line-through",
                        )}
                        title={outside(d, t) ? "Fora do horário de funcionamento: não aparece para as clientes" : undefined}
                      >
                        {t}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => removeSlotAction(s.id), `Horário ${t} removido.`)}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remover ${t} de ${WEEKDAY_NAMES[d]}`}
                        >
                          <X className="size-4" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum horário.</p>
              )}
            </div>
          );
        })}
      </div>

      {openDays.length > 1 && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-from">Copiar os horários de</Label>
            <NativeSelect id="copy-from" value={copyFrom} onChange={(e) => setCopyFrom(Number(e.target.value))} className="w-48">
              {openDays.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAMES[d]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Substituir os horários dos outros dias abertos pelos de ${WEEKDAY_NAMES[copyFrom]}?`)) return;
              run(
                () => copySlotsAction(copyFrom, openDays.filter((d) => d !== copyFrom)),
                "Horários copiados para os outros dias abertos.",
              );
            }}
          >
            <Copy /> Para os outros dias abertos
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Regras online ------------------------------ */

export function BookingRulesForm({
  initial,
}: {
  initial: { min_advance_minutes: number; booking_window_days: number; max_active_bookings_per_phone: number; welcome_message: string | null };
}) {
  const router = useRouter();
  const [advanceHours, setAdvanceHours] = useState(String(initial.min_advance_minutes / 60));
  const [windowDays, setWindowDays] = useState(String(initial.booking_window_days));
  const [maxActive, setMaxActive] = useState(String(initial.max_active_bookings_per_phone));
  const [welcome, setWelcome] = useState(initial.welcome_message ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const minAdvanceMinutes = Math.round(Number(advanceHours.replace(",", ".")) * 60);
    const bookingWindowDays = Number(windowDays);
    const maxActiveBookingsPerPhone = Number(maxActive);
    if (![minAdvanceMinutes, bookingWindowDays, maxActiveBookingsPerPhone].every(Number.isFinite)) return setError("Confira os números.");
    start(async () => {
      const res = await saveBookingRulesAction({ minAdvanceMinutes, bookingWindowDays, maxActiveBookingsPerPhone, welcomeMessage: welcome });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      toast.success("Regras salvas.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="r-adv">Antecedência mínima (horas)</Label>
          <Input id="r-adv" inputMode="decimal" value={advanceHours} onChange={(e) => setAdvanceHours(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r-window">Agenda aberta por (dias)</Label>
          <Input id="r-window" inputMode="numeric" value={windowDays} onChange={(e) => setWindowDays(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="r-max">Reservas abertas por telefone</Label>
          <Input id="r-max" inputMode="numeric" value={maxActive} onChange={(e) => setMaxActive(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="r-welcome">Mensagem da página inicial</Label>
        <Textarea id="r-welcome" value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={300} className="min-h-20" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" loading={pending} className="w-full sm:w-fit">
        Salvar regras
      </Button>
    </form>
  );
}
