"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonthYear, monthGrid, startOfMonth, todayKey, WEEKDAY_INITIALS, type DateKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  month: DateKey;
  minMonth: DateKey;
  maxMonth: DateKey;
  availableDates: Set<string>;
  selected: DateKey | null;
  loading: boolean;
  onMonthChange: (month: DateKey) => void;
  onSelect: (date: DateKey) => void;
};

/** Calendário simples: apenas os dias com horários livres podem ser tocados. */
export function DateCalendar({ month, minMonth, maxMonth, availableDates, selected, loading, onMonthChange, onSelect }: Props) {
  const today = todayKey();
  const cells = monthGrid(month);
  const canPrev = startOfMonth(month) > minMonth;
  const canNext = startOfMonth(month) < maxMonth;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm shadow-primary/5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!canPrev}
          className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-primary-dark transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-30"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-6" />
        </button>
        <p className="text-base font-semibold first-letter:uppercase text-primary-dark" aria-live="polite">
          {formatMonthYear(month)}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={!canNext}
          className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-primary-dark transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendário">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={i} className="pb-1 text-xs font-semibold text-muted-foreground" aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          if (loading) return <Skeleton key={date} className="aspect-square rounded-xl" />;
          const available = availableDates.has(date);
          const isSelected = selected === date;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              disabled={!available}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${Number(date.slice(8))}${available ? ", com horários" : ", sem horários"}`}
              className={cn(
                "relative flex aspect-square cursor-pointer items-center justify-center rounded-xl text-base font-semibold transition-all duration-150",
                available && !isSelected && "bg-secondary text-primary-dark hover:bg-accent/50",
                isSelected && "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105",
                !available && "cursor-default font-normal text-muted-foreground/40",
                isToday && !isSelected && "ring-2 ring-accent ring-inset",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
