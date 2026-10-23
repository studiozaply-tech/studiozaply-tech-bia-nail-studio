"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, LogOut, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/admin/login/actions";

const ITEMS = [
  { href: "/admin", label: "Início", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/servicos", label: "Serviços", icon: Sparkles },
  { href: "/admin/configuracoes", label: "Ajustes", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Menu do painel">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "flex h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors",
            isActive(pathname, href) ? "bg-primary text-primary-foreground" : "text-primary-dark hover:bg-secondary",
          )}
        >
          <Icon className="size-5" aria-hidden /> {label === "Ajustes" ? "Configurações" : label}
        </Link>
      ))}
      <form action={signOut} className="mt-4">
        <button
          type="submit"
          className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary-dark"
        >
          <LogOut className="size-5" aria-hidden /> Sair
        </button>
      </form>
    </nav>
  );
}

export function AdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Menu do painel"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
            isActive(pathname, href) ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Icon className={cn("size-6", isActive(pathname, href) && "scale-110")} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary" aria-label="Sair">
        <LogOut className="size-5" />
      </button>
    </form>
  );
}
