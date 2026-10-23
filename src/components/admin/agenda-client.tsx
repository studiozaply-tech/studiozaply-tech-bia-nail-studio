"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewAppointmentDialog, type ServiceOption } from "./appointment-dialogs";
import { deleteBlockAction } from "@/app/admin/actions";

export function FreeSlotRow({ services, date, time }: { services: ServiceOption[]; date: string; time: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-3 text-left transition-colors hover:border-accent hover:bg-card"
      >
        <span className="flex min-w-16 justify-center rounded-xl bg-muted px-2 py-2 text-lg font-bold text-muted-foreground">{time}</span>
        <span className="flex-1 text-muted-foreground">Livre</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary opacity-80 group-hover:opacity-100">
          <Plus className="size-4" aria-hidden /> Agendar
        </span>
      </button>
      {open && <NewAppointmentDialog open={open} onOpenChange={setOpen} services={services} defaultDate={date} defaultTime={time} />}
    </>
  );
}

export function DeleteBlockButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Manter
        </Button>
        <Button
          size="sm"
          variant="destructive"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteBlockAction(id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Bloqueio removido. Os horários voltaram a ficar disponíveis.");
              router.refresh();
            })
          }
        >
          Remover
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label="Remover bloqueio">
      <Trash2 />
    </Button>
  );
}
