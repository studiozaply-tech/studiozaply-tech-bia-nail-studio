"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Check, CheckCheck, MessageSquare, NotebookPen, Phone, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "./status";
import { RescheduleDialog } from "./appointment-dialogs";
import { setAppointmentStatusAction, updateInternalNotesAction } from "@/app/admin/actions";
import { formatDateLong, formatWeekdayShort, toDateKey, toTimeKey } from "@/lib/datetime";
import { formatPhone, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/database";
import type { AdminAppointment } from "@/lib/data/admin-types";

export function AppointmentCard({ appointment: a, showDate = false }: { appointment: AdminAppointment; showDate?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const setStatus = (status: AppointmentStatus, success: string, reason?: string) =>
    start(async () => {
      const res = await setAppointmentStatusAction(a.id, status, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      setCancelOpen(false);
      router.refresh();
    });

  const dateKey = toDateKey(a.starts_at);
  const time = toTimeKey(a.starts_at);
  const inactive = a.status === "cancelled";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-opacity",
        inactive && "opacity-60",
        a.status === "pending" && "border-l-4 border-l-warning",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-16 flex-col items-center rounded-xl bg-secondary px-2 py-2 text-secondary-foreground">
          <span className="text-lg font-bold leading-none">{time}</span>
          {showDate && (
            <span className="mt-1 text-[11px] font-medium first-letter:uppercase">
              {formatWeekdayShort(dateKey)} {dateKey.slice(8)}/{dateKey.slice(5, 7)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/clientes/${a.client_id}`} className="truncate font-semibold text-foreground hover:text-primary hover:underline">
              {a.client_name}
            </Link>
            <StatusBadge status={a.status} />
            {a.source === "online" && <span className="text-xs text-muted-foreground">online</span>}
          </div>
          <p className="mt-0.5 text-sm text-primary-dark">
            {a.service_name} · <span className="font-semibold">{formatPrice(a.service_price_cents)}</span>
          </p>
          <a href={`tel:${a.client_phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <Phone className="size-3.5" aria-hidden /> {formatPhone(a.client_phone)}
          </a>
          {a.client_notes && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-muted px-2 py-1.5 text-sm">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {a.client_notes}
            </p>
          )}
          {a.internal_notes && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-warning-soft px-2 py-1.5 text-sm text-foreground">
              <NotebookPen className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {a.internal_notes}
            </p>
          )}
          {a.status === "cancelled" && a.cancellation_reason && (
            <p className="mt-2 text-sm text-muted-foreground">Motivo: {a.cancellation_reason}</p>
          )}
        </div>
      </div>

      {!inactive && a.status !== "completed" && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {a.status === "pending" && (
            <Button size="sm" onClick={() => setStatus("confirmed", "Reserva confirmada!")} disabled={pending}>
              <Check /> Confirmar
            </Button>
          )}
          {(a.status === "confirmed" || a.status === "no_show") && (
            <Button size="sm" variant="success" onClick={() => setStatus("completed", "Atendimento concluído!")} disabled={pending}>
              <CheckCheck /> Concluir
            </Button>
          )}
          {(a.status === "pending" || a.status === "confirmed") && (
            <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)} disabled={pending}>
              <CalendarClock /> Remarcar
            </Button>
          )}
          {a.status === "confirmed" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("no_show", "Marcado como não compareceu.")} disabled={pending}>
              <UserX /> Faltou
            </Button>
          )}
          {(a.status === "pending" || a.status === "confirmed") && (
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)} disabled={pending}>
              <X /> Cancelar
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotesOpen(true)} disabled={pending} aria-label="Anotação interna">
            <NotebookPen />
          </Button>
        </div>
      )}

      {cancelOpen && (
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          pending={pending}
          description={`${a.client_name} · ${formatDateLong(dateKey)} às ${time}`}
          onConfirm={(reason) => setStatus("cancelled", "Agendamento cancelado. O horário foi liberado.", reason)}
        />
      )}
      {rescheduleOpen && (
        <RescheduleDialog
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          appointmentId={a.id}
          currentDate={dateKey}
          currentTime={time}
        />
      )}
      {notesOpen && <NotesDialog open={notesOpen} onOpenChange={setNotesOpen} id={a.id} initial={a.internal_notes ?? ""} />}
    </article>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
  description: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar agendamento?</DialogTitle>
          <DialogDescription>{description}. O horário volta a ficar disponível.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="min-h-16" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" loading={pending} onClick={() => onConfirm(reason)}>
            Sim, cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotesDialog({ open, onOpenChange, id, initial }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; initial: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anotação interna</DialogTitle>
          <DialogDescription>Visível apenas no painel.</DialogDescription>
        </DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} aria-label="Anotação interna" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updateInternalNotesAction(id, notes);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Anotação salva.");
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
