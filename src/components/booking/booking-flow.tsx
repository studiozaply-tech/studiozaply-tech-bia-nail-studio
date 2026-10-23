"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  MessageSquarePlus,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandName } from "@/components/brand/brand-name";
import { DateCalendar } from "./date-calendar";
import { ServiceCardContent, serviceCardClass } from "./service-card";
import {
  checkSlotAvailable,
  createBooking,
  fetchAvailableDates,
  fetchAvailableSlots,
  type BookingConfirmation,
  type Slot,
} from "@/app/agendar/actions";
import type { PublicService } from "@/lib/data/public";
import { addDays, addMonths, formatDateLong, startOfMonth, todayKey, toDateKey, toTimeKey, type DateKey } from "@/lib/datetime";
import { formatPhone, formatPrice, maskPhoneInput, normalizePhone } from "@/lib/format";
import { SLOT_TAKEN_MESSAGE } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Step = "service" | "datetime" | "details" | "confirm" | "success";
const STEP_ORDER: Step[] = ["service", "datetime", "details", "confirm"];
const STEP_TITLES: Record<Step, string> = {
  service: "Escolha o serviço",
  datetime: "Escolha o dia e o horário",
  details: "Seus dados",
  confirm: "Confira e confirme",
  success: "Agendamento feito!",
};

type Props = {
  professionalId: string;
  /** "" para o estúdio principal ou "/p/<link>" para os outros. */
  basePath: string;
  services: PublicService[];
  initialServiceId?: string;
  bookingWindowDays: number;
  displayName: string;
};

/** Estúdio da página: todas as consultas e a reserva usam este id. */
const StudioContext = createContext({ professionalId: "", basePath: "", displayName: "" });

export function BookingFlow({ professionalId, basePath, services, initialServiceId, bookingWindowDays, displayName }: Props) {
  const initialService = services.find((s) => s.id === initialServiceId) ?? null;
  const [step, setStep] = useState<Step>(initialService ? "datetime" : "service");
  const [service, setService] = useState<PublicService | null>(initialService);
  const [date, setDate] = useState<DateKey | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback((next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Leva o foco ao título de cada etapa (leitores de tela e teclado).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const back = () => {
    if (step === "datetime") go("service");
    else if (step === "details") go("datetime");
    else if (step === "confirm") go("details");
  };

  /** Horário ocupado ou indisponível: volta para a seleção de horários. */
  const handleSlotLost = useCallback(
    (message: string) => {
      setSlot(null);
      setSlotNotice(message);
      go("datetime");
    },
    [go],
  );

  return (
    <StudioContext.Provider value={{ professionalId, basePath, displayName }}>
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-4">
      <header className="flex items-center justify-between gap-2">
        {step !== "success" && stepIndex > 0 ? (
          <Button variant="ghost" size="sm" onClick={back} className="-ml-2 h-11 px-3 text-base">
            <ArrowLeft /> Voltar
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-11 px-3 text-base">
            <Link href={basePath || "/"}>
              <Home /> Início
            </Link>
          </Button>
        )}
        <BrandName name={displayName} href={basePath || "/"} className="text-sm tracking-[0.18em]" />
      </header>

      {step !== "success" && (
        <div className="mt-4" aria-label={`Passo ${stepIndex + 1} de ${STEP_ORDER.length}`}>
          <div className="flex gap-1.5" aria-hidden>
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= stepIndex ? "bg-primary" : "bg-border")}
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Passo {stepIndex + 1} de {STEP_ORDER.length}
          </p>
        </div>
      )}

      <h1
        ref={headingRef}
        tabIndex={-1}
        className={cn(
          "font-display text-3xl font-semibold text-primary-dark outline-none",
          step === "success" ? "mt-10 text-center" : "mt-1",
        )}
      >
        {STEP_TITLES[step]}
      </h1>

      <div key={step} className="mt-6 flex flex-1 flex-col animate-in fade-in slide-in-from-right-4 duration-300">
        {step === "service" && (
          <ServiceStep
            services={services}
            selectedId={service?.id}
            onSelect={(s) => {
              if (s.id !== service?.id) setSlot(null);
              setService(s);
              go("datetime");
            }}
          />
        )}

        {step === "datetime" && service && (
          <DateTimeStep
            service={service}
            date={date}
            slot={slot}
            notice={slotNotice}
            bookingWindowDays={bookingWindowDays}
            onDateChange={(d) => {
              setDate(d);
              setSlot(null);
              setSlotNotice(null);
            }}
            onSlotSelect={(s) => {
              setSlot(s);
              setSlotNotice(null);
              go("details");
            }}
            onChangeService={() => go("service")}
          />
        )}

        {step === "details" && (
          <DetailsStep
            fullName={fullName}
            phone={phone}
            notes={notes}
            onChange={(field, value) => {
              if (field === "fullName") setFullName(value);
              if (field === "phone") setPhone(value);
              if (field === "notes") setNotes(value);
            }}
            onNext={() => go("confirm")}
          />
        )}

        {step === "confirm" && service && slot && (
          <ConfirmStep
            service={service}
            slot={slot}
            fullName={fullName}
            phone={phone}
            notes={notes}
            onEdit={(target) => go(target)}
            onSlotLost={handleSlotLost}
            onConfirmed={(c) => {
              setConfirmation(c);
              go("success");
            }}
          />
        )}

        {step === "success" && confirmation && <SuccessStep confirmation={confirmation} fullName={fullName} />}
      </div>
    </div>
    </StudioContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* TELA 2 — SERVIÇOS                                                   */
/* ------------------------------------------------------------------ */

function ServiceStep({
  services,
  selectedId,
  onSelect,
}: {
  services: PublicService[];
  selectedId?: string;
  onSelect: (s: PublicService) => void;
}) {
  if (!services.length) {
    return <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground">Nenhum serviço disponível no momento.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {services.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={cn(serviceCardClass, selectedId === s.id && "border-primary")}
            onClick={() => onSelect(s)}
            aria-pressed={selectedId === s.id}
          >
            <ServiceCardContent name={s.name} description={s.description} priceCents={s.price_cents} selected={selectedId === s.id} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* TELA 3 — DATA E HORÁRIO                                             */
/* ------------------------------------------------------------------ */

function DateTimeStep({
  service,
  date,
  slot,
  notice,
  bookingWindowDays,
  onDateChange,
  onSlotSelect,
  onChangeService,
}: {
  service: PublicService;
  date: DateKey | null;
  slot: Slot | null;
  notice: string | null;
  bookingWindowDays: number;
  onDateChange: (d: DateKey) => void;
  onSlotSelect: (s: Slot) => void;
  onChangeService: () => void;
}) {
  const { professionalId } = useContext(StudioContext);
  const today = todayKey();
  const minMonth = startOfMonth(today);
  const maxMonth = startOfMonth(addDays(today, bookingWindowDays));
  const [month, setMonth] = useState<DateKey>(date ? startOfMonth(date) : minMonth);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [datesLoading, setDatesLoading] = useState(true);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, startSlots] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);
  const autoJumped = useRef(false);
  const hasDate = useRef(Boolean(date));
  hasDate.current = Boolean(date);

  // Dias com horário livre no mês visível (consulta no servidor).
  useEffect(() => {
    let cancelled = false;
    setDatesLoading(true);
    setDatesError(null);
    const lastDay = addDays(addMonths(month, 1), -1);
    fetchAvailableDates(professionalId, month, lastDay).then((res) => {
      if (cancelled) return;
      setDatesLoading(false);
      if (!res.ok) {
        setDatesError(res.error);
        return;
      }
      const set = new Set(res.data);
      setAvailableDates(set);
      // Mês atual sem horários: avança uma vez automaticamente para o próximo.
      if (!set.size && !autoJumped.current && !hasDate.current && month < maxMonth) {
        autoJumped.current = true;
        setMonth(addMonths(month, 1));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [professionalId, month, reloadKey, maxMonth]);

  // Horários do dia escolhido (sempre recarrega para refletir reservas novas).
  const loadSlots = useCallback((d: DateKey) => {
    setSlotsError(null);
    startSlots(async () => {
      const res = await fetchAvailableSlots(professionalId, d);
      if (res.ok) setSlots(res.data);
      else {
        setSlots(null);
        setSlotsError(res.error);
      }
    });
  }, [professionalId]);

  useEffect(() => {
    if (date) loadSlots(date);
  }, [date, loadSlots]);

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onChangeService}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-3">
          <Sparkles className="size-5 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold text-primary-dark">{service.name}</span>
            <span className="text-sm text-primary">{formatPrice(service.price_cents)}</span>
          </span>
        </span>
        <span className="text-sm font-semibold text-primary underline-offset-4">Trocar</span>
      </button>

      {notice && (
        <Alert variant="destructive" className="animate-in fade-in zoom-in-95">
          <AlertCircle aria-hidden />
          <p className="whitespace-pre-line font-semibold">{notice}</p>
        </Alert>
      )}

      {datesError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <div className="flex flex-col gap-3">
            <p>{datesError}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} className="w-fit">
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <DateCalendar
            month={month}
            minMonth={minMonth}
            maxMonth={maxMonth}
            availableDates={availableDates}
            selected={date}
            loading={datesLoading}
            onMonthChange={setMonth}
            onSelect={onDateChange}
          />
          {!datesLoading && availableDates.size === 0 && (
            <p className="rounded-2xl bg-card p-4 text-center text-muted-foreground">
              Não há horários livres neste mês.
              {month < maxMonth ? " Toque na seta para ver o próximo mês." : " Novos horários serão abertos em breve."}
            </p>
          )}
        </>
      )}

      {date && (
        <section aria-labelledby="horarios" className="animate-in fade-in slide-in-from-bottom-2">
          <h2 id="horarios" className="mb-3 flex items-center gap-2 text-lg font-semibold first-letter:uppercase text-primary-dark">
            <Clock className="size-5 text-primary" aria-hidden /> {formatDateLong(date)}
          </h2>
          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : slotsError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <div className="flex flex-col gap-3">
                <p>{slotsError}</p>
                <Button variant="outline" size="sm" onClick={() => loadSlots(date)} className="w-fit">
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          ) : slots && slots.length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-center text-muted-foreground">
              Os horários deste dia acabaram de ser preenchidos. Escolha outro dia.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots?.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => onSlotSelect(s)}
                  aria-pressed={slot?.startsAt === s.startsAt}
                  className={cn(
                    "h-14 cursor-pointer rounded-xl border-2 text-lg font-semibold transition-all duration-150 active:scale-95",
                    slot?.startsAt === s.startsAt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent bg-card text-primary-dark shadow-sm hover:border-accent",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TELA 4 — DADOS                                                      */
/* ------------------------------------------------------------------ */

function DetailsStep({
  fullName,
  phone,
  notes,
  onChange,
  onNext,
}: {
  fullName: string;
  phone: string;
  notes: string;
  onChange: (field: "fullName" | "phone" | "notes", value: string) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; notes?: string }>({});
  const [showNotes, setShowNotes] = useState(Boolean(notes));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || !/\p{L}/u.test(name)) next.fullName = "Digite seu nome completo.";
    if (!normalizePhone(phone)) next.phone = "Digite um telefone com DDD. Ex.: (11) 91234-5678";
    if (notes.length > 500) next.notes = "A observação pode ter até 500 caracteres.";
    setErrors(next);
    if (Object.keys(next).length === 0) onNext();
    else document.getElementById(next.fullName ? "fullName" : next.phone ? "phone" : "notes")?.focus();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName" className="text-base">
          Nome completo
        </Label>
        <Input
          id="fullName"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="Como você se chama?"
          value={fullName}
          maxLength={120}
          onChange={(e) => onChange("fullName", e.target.value)}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
        />
        {errors.fullName && <FieldError id="fullName-error">{errors.fullName}</FieldError>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone" className="text-base">
          Telefone (com DDD)
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          enterKeyHint="done"
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => onChange("phone", maskPhoneInput(e.target.value))}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
        />
        {errors.phone && <FieldError id="phone-error">{errors.phone}</FieldError>}
      </div>

      {showNotes ? (
        <div className="flex flex-col gap-2 animate-in fade-in">
          <Label htmlFor="notes" className="text-base">
            Observação <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Ex.: tenho alergia a algum produto"
            value={notes}
            maxLength={500}
            onChange={(e) => onChange("notes", e.target.value)}
            aria-invalid={Boolean(errors.notes)}
          />
          <span className="text-right text-xs text-muted-foreground">{notes.length}/500</span>
          {errors.notes && <FieldError id="notes-error">{errors.notes}</FieldError>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-lg py-2 font-semibold text-primary hover:underline"
        >
          <MessageSquarePlus className="size-5" aria-hidden /> Adicionar observação
        </button>
      )}

      <p className="text-sm text-muted-foreground">Seus dados são usados apenas para o seu atendimento.</p>

      <div className="mt-auto pt-4">
        <Button type="submit" size="xl">
          Continuar <ArrowRight />
        </Button>
      </div>
    </form>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
      <AlertCircle className="size-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* TELA 5 — CONFIRMAÇÃO                                                */
/* ------------------------------------------------------------------ */

function ConfirmStep({
  service,
  slot,
  fullName,
  phone,
  notes,
  onEdit,
  onSlotLost,
  onConfirmed,
}: {
  service: PublicService;
  slot: Slot;
  fullName: string;
  phone: string;
  notes: string;
  onEdit: (step: Step) => void;
  onSlotLost: (message: string) => void;
  onConfirmed: (c: BookingConfirmation) => void;
}) {
  const { professionalId } = useContext(StudioContext);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  // Revalida no servidor assim que a tela abre.
  useEffect(() => {
    let cancelled = false;
    checkSlotAvailable(professionalId, slot.startsAt).then((res) => {
      if (!cancelled && res.ok && !res.data) onSlotLost(SLOT_TAKEN_MESSAGE);
    });
    return () => {
      cancelled = true;
    };
  }, [professionalId, slot.startsAt, onSlotLost]);

  const confirm = () => {
    if (submittedRef.current) return; // evita duplo toque
    submittedRef.current = true;
    setError(null);
    startSubmit(async () => {
      const res = await createBooking({
        professionalId,
        serviceId: service.id,
        startsAt: slot.startsAt,
        fullName,
        phone,
        notes,
      });
      if (res.ok) {
        onConfirmed(res.data);
        return;
      }
      submittedRef.current = false;
      if (res.code === "SLOT_TAKEN" || res.code === "SLOT_UNAVAILABLE") {
        onSlotLost(res.error);
        return;
      }
      if (res.code === "SERVICE_UNAVAILABLE") {
        toast.error(res.error);
        onEdit("service");
        return;
      }
      if (res.fieldErrors?.fullName || res.fieldErrors?.phone || res.code === "INVALID_NAME" || res.code === "INVALID_PHONE") {
        toast.error(res.error);
        onEdit("details");
        return;
      }
      setError(res.error);
    });
  };

  const dateKey = toDateKey(slot.startsAt);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="overflow-hidden rounded-3xl bg-card shadow-md shadow-primary/10">
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <p className="text-sm opacity-90">Serviço</p>
          <p className="text-xl font-semibold">{service.name}</p>
          <p className="mt-1 text-2xl font-bold">{formatPrice(service.price_cents)}</p>
        </div>
        <dl className="divide-y divide-border">
          <SummaryRow icon={<CalendarDays />} label="Data" value={formatDateLong(dateKey)} onEdit={() => onEdit("datetime")} />
          <SummaryRow icon={<Clock />} label="Horário" value={toTimeKey(slot.startsAt)} onEdit={() => onEdit("datetime")} />
          <SummaryRow
            icon={<User />}
            label="Seus dados"
            value={
              <>
                {fullName.trim()}
                <span className="block text-sm font-normal text-muted-foreground">{formatPhone(normalizePhone(phone) ?? phone)}</span>
              </>
            }
            onEdit={() => onEdit("details")}
          />
          {notes.trim() && (
            <SummaryRow icon={<MessageSquarePlus />} label="Observação" value={notes.trim()} onEdit={() => onEdit("details")} />
          )}
        </dl>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <p>{error}</p>
        </Alert>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button size="xl" onClick={confirm} loading={submitting}>
          {submitting ? "Salvando seu horário..." : "Confirmar agendamento"}
          {!submitting && <CalendarCheck />}
        </Button>
        <p className="text-center text-sm text-muted-foreground">O pagamento é feito no dia do atendimento.</p>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="text-primary [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="break-words font-semibold first-letter:uppercase">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="cursor-pointer rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-secondary"
        aria-label={`Alterar ${label.toLowerCase()}`}
      >
        Alterar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TELA 6 — SUCESSO (somente após gravar no banco)                     */
/* ------------------------------------------------------------------ */

function SuccessStep({ confirmation, fullName }: { confirmation: BookingConfirmation; fullName: string }) {
  const { basePath, displayName } = useContext(StudioContext);
  const firstName = fullName.trim().split(" ")[0];
  const dateKey = toDateKey(confirmation.startsAt);

  const downloadIcs = () => {
    const start = new Date(confirmation.startsAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bia Nail Studio//Agendamento//PT-BR",
      "BEGIN:VEVENT",
      `UID:${confirmation.appointmentId}@bianailstudio`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${confirmation.serviceName} · ${displayName}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "agendamento-beatriz-abreu.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-success-soft text-success animate-in zoom-in-50 duration-500">
        <CheckCircle2 className="size-14" aria-hidden />
      </span>
      <p className="mt-6 text-lg text-muted-foreground" role="status">
        {firstName ? `${firstName}, seu` : "Seu"} horário está reservado. Te esperamos!
      </p>

      <div className="mt-6 w-full rounded-3xl bg-card p-5 text-left shadow-md shadow-primary/10">
        <p className="text-sm text-muted-foreground">Serviço</p>
        <p className="text-lg font-semibold">{confirmation.serviceName}</p>
        <p className="font-bold text-primary">{formatPrice(confirmation.priceCents)}</p>
        <div className="my-4 h-px bg-border" />
        <p className="text-sm text-muted-foreground">Quando</p>
        <p className="text-lg font-semibold first-letter:uppercase">{formatDateLong(dateKey)}</p>
        <p className="text-lg font-semibold text-primary">às {toTimeKey(confirmation.startsAt)}</p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Sua reserva foi registrada e aguarda a confirmação da profissional. Se precisar mudar algo, fale com ela.
      </p>

      <div className="mt-auto flex w-full flex-col gap-2 pt-8">
        <Button size="xl" variant="outline" onClick={downloadIcs}>
          <CalendarDays /> Salvar no meu calendário
        </Button>
        <Button asChild size="xl">
          <Link href={basePath || "/"}>
            <Home /> Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
}
