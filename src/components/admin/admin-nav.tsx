"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Check, Copy, LayoutDashboard, LogOut, Plus, Settings, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/admin/login/actions";

const ITEMS = [
  { href: "/admin", label: "Início", long: "Início", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", long: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", long: "Clientes", icon: Users },
  { href: "/admin/servicos", label: "Serviços", long: "Serviços", icon: Sparkles },
  { href: "/admin/configuracoes", label: "Ajustes", long: "Configurações", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function NewAppointmentShortcut() {
  return (
    <Link
      href="/admin/agenda?novo=1"
      className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm shadow-primary/10 transition-transform hover:-translate-y-0.5"
    >
      <span className="text-sm font-semibold leading-tight text-foreground">
        Novo
        <br />
        agendamento
      </span>
      <span className="flex size-8 items-center justify-center rounded-full border-2 border-accent text-primary" aria-hidden>
        <Plus className="size-4" />
      </span>
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1.5" aria-label="Menu do painel">
      {ITEMS.map(({ href, long, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all",
              active
                ? "bg-brand-gradient text-white shadow-md shadow-brand-to/30"
                : "text-sidebar-foreground/85 hover:bg-card/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden /> {long}
          </Link>
        );
      })}
    </nav>
  );
}

export function BookingLinkCard() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado! Envie para suas clientes.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.message(url);
    }
  };
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-sm shadow-primary/10">
      <span className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-brand-gradient opacity-20" aria-hidden />
      <p className="bg-brand-gradient bg-clip-text font-display text-lg font-semibold text-transparent">Seu link</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Envie para as clientes agendarem sozinhas, a qualquer hora.
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-brand-gradient px-4 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}

export function AdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Menu do painel"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-all", active && "bg-brand-gradient text-white")}>
              <Icon className="size-5" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl text-sidebar-foreground/80 transition-colors hover:bg-card/60 hover:text-sidebar-foreground",
          withLabel ? "h-11 w-full px-3 text-sm font-semibold" : "size-10 justify-center",
        )}
        aria-label="Sair"
      >
        <LogOut className="size-5" aria-hidden /> {withLabel && "Sair"}
      </button>
    </form>
  );
}
