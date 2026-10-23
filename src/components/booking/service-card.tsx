import { Check, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  description?: string | null;
  priceCents: number;
  selected?: boolean;
  actionLabel?: string;
};

/** Conteúdo visual do cartão de serviço (o elemento clicável é definido por quem usa). */
export function ServiceCardContent({ name, description, priceCents, selected, actionLabel = "Escolher" }: Props) {
  return (
    <div className="flex w-full items-center gap-4">
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-6" /> : <Sparkles className="size-6" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-base font-semibold leading-snug text-foreground">{name}</span>
        {description && <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</span>}
        <span className="mt-1 text-lg font-bold text-primary">{formatPrice(priceCents)}</span>
      </span>
      <span
        className={cn(
          "hidden shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors min-[380px]:inline-flex",
          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary-dark group-hover:bg-primary group-hover:text-primary-foreground",
        )}
        aria-hidden
      >
        {selected ? "Escolhido" : actionLabel}
      </span>
    </div>
  );
}

export const serviceCardClass =
  "group flex w-full cursor-pointer rounded-2xl border-2 border-transparent bg-card p-4 text-left shadow-sm shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md active:translate-y-0 focus-visible:border-primary";
