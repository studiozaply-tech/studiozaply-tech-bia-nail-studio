"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchAdminDaySlots, type AdminSlot } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Escolha de horário no painel: horários configurados do dia + horário livre digitado. */
export function SlotPicker({
  date,
  value,
  onChange,
  currentTime,
}: {
  date: string;
  value: string;
  onChange: (time: string) => void;
  /** Horário atual do agendamento (remarcação): não aparece como ocupado. */
  currentTime?: string;
}) {
  const [slots, setSlots] = useState<AdminSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  useEffect(() => {
    if (!date) return;
    start(async () => {
      const res = await fetchAdminDaySlots(date);
      if (res.ok) {
        setSlots(res.data);
        setError(null);
      } else {
        setSlots(null);
        setError(res.error);
      }
    });
  }, [date]);

  return (
    <div className="flex flex-col gap-3">
      <Label>Horário</Label>
      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : slots && slots.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => {
            const isCurrent = s.time === currentTime;
            const disabled = s.state !== "free" && !isCurrent;
            return (
              <button
                key={s.time}
                type="button"
                disabled={disabled}
                onClick={() => onChange(s.time)}
                aria-pressed={value === s.time}
                title={s.state === "taken" ? "Ocupado" : s.state === "blocked" ? "Bloqueado" : "Livre"}
                className={cn(
                  "h-11 cursor-pointer rounded-xl border-2 text-sm font-semibold transition-colors",
                  value === s.time ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent",
                  disabled && "cursor-not-allowed border-transparent bg-muted text-muted-foreground line-through",
                )}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum horário configurado para este dia. Digite um horário abaixo.</p>
      )}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">ou outro horário:</span>
        <Input type="time" step={300} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-32" aria-label="Outro horário" />
      </div>
    </div>
  );
}
