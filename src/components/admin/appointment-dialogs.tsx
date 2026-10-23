"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { SlotPicker } from "./slot-picker";
import { createAppointmentAction, createBlockAction, rescheduleAppointmentAction } from "@/app/admin/actions";
import { centsToInput, formatPrice, maskPhoneInput, parsePriceToCents } from "@/lib/format";
import { todayKey } from "@/lib/datetime";

export type ServiceOption = { id: string; name: string; price_cents: number; is_active: boolean };

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="whitespace-pre-line text-sm font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

/* ----------------------------- Novo agendamento ----------------------------- */

export function NewAppointmentDialog({
  open,
  onOpenChange,
  services,
  defaultDate,
  defaultTime = "",
  defaultClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ServiceOption[];
  defaultDate?: string;
  defaultTime?: string;
  defaultClient?: { fullName: string; phone: string };
}) {
  const router = useRouter();
  const activeServices = services.filter((s) => s.is_active);
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "");
  const [price, setPrice] = useState(activeServices[0] ? centsToInput(activeServices[0].price_cents) : "");
  const [date, setDate] = useState(defaultDate ?? todayKey());
  const [time, setTime] = useState(defaultTime);
  const [fullName, setFullName] = useState(defaultClient?.fullName ?? "");
  const [phone, setPhone] = useState(defaultClient ? maskPhoneInput(defaultClient.phone) : "");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return setError("Escolha um horário.");
    const priceCents = parsePriceToCents(price);
    if (priceCents === null) return setError("Preço inválido.");
    setError(undefined);
    start(async () => {
      const res = await createAppointmentAction({
        serviceId,
        date,
        time,
        fullName,
        phone,
        notes,
        status: confirmed ? "confirmed" : "pending",
        priceCents,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Agendamento criado!");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>O horário é verificado no servidor antes de salvar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="na-service">Serviço</Label>
              <NativeSelect
                id="na-service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  const s = services.find((x) => x.id === e.target.value);
                  if (s) setPrice(centsToInput(s.price_cents));
                }}
              >
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatPrice(s.price_cents)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="na-price">Preço (R$)</Label>
              <Input id="na-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="na-date">Data</Label>
            <Input id="na-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setTime(""))} required />
          </div>
          {date && <SlotPicker date={date} value={time} onChange={setTime} />}
          <div className="flex flex-col gap-2">
            <Label htmlFor="na-name">Nome da cliente</Label>
            <Input id="na-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="na-phone">Telefone</Label>
            <Input
              id="na-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
              placeholder="(11) 91234-5678"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="na-notes">Observação (opcional)</Label>
            <Textarea id="na-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-16" />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
            <span className="font-semibold text-secondary-foreground">Já confirmado</span>
            <Switch checked={confirmed} onCheckedChange={setConfirmed} />
          </label>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              {!pending && <CalendarPlus />} Salvar agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Remarcar -------------------------------- */

export function RescheduleDialog({
  open,
  onOpenChange,
  appointmentId,
  currentDate,
  currentTime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  currentDate: string;
  currentTime: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return setError("Escolha um horário.");
    setError(undefined);
    start(async () => {
      const res = await rescheduleAppointmentAction(appointmentId, date, time);
      if (!res.ok) return setError(res.error);
      toast.success("Agendamento remarcado!");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remarcar</DialogTitle>
          <DialogDescription>O horário antigo fica livre assim que você salvar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rs-date">Nova data</Label>
            <Input id="rs-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setTime(""))} required />
          </div>
          {date && <SlotPicker date={date} value={time} onChange={setTime} currentTime={date === currentDate ? currentTime : undefined} />}
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar novo horário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Bloqueio -------------------------------- */

export function BlockDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (open: boolean) => void; defaultDate?: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate ?? todayKey());
  const [endDate, setEndDate] = useState(defaultDate ?? todayKey());
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await createBlockAction({
        date,
        endDate: endDate < date ? date : endDate,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        reason,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Bloqueio criado. Esses horários não aparecem mais para as clientes.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear agenda</DialogTitle>
          <DialogDescription>Agendamentos já marcados no período não são cancelados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
            <span className="font-semibold text-secondary-foreground">Dia inteiro</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bl-date">{allDay ? "De" : "Dia"}</Label>
              <Input
                id="bl-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (endDate < e.target.value || !allDay) setEndDate(e.target.value);
                }}
                required
              />
            </div>
            {allDay ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="bl-end">Até</Label>
                <Input id="bl-end" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            ) : (
              <div />
            )}
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bl-start">Das</Label>
                <Input id="bl-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bl-stop">Até</Label>
                <Input id="bl-stop" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="bl-reason">Motivo (opcional, só você vê)</Label>
            <Input id="bl-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex.: curso, folga" />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              {!pending && <Ban />} Bloquear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Botões que abrem os diálogos (usados em páginas server-side). */
export function NewAppointmentButton(props: {
  services: ServiceOption[];
  defaultDate?: string;
  defaultClient?: { fullName: string; phone: string };
  label?: string;
  variant?: "default" | "outline";
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.autoOpen ?? false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={props.variant}>
        <CalendarPlus /> {props.label ?? "Novo agendamento"}
      </Button>
      {open && (
        <NewAppointmentDialog
          open={open}
          onOpenChange={setOpen}
          services={props.services}
          defaultDate={props.defaultDate}
          defaultClient={props.defaultClient}
        />
      )}
    </>
  );
}

export function BlockButton({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Ban /> Bloquear
      </Button>
      {open && <BlockDialog open={open} onOpenChange={setOpen} defaultDate={defaultDate} />}
    </>
  );
}
