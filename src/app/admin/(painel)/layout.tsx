import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { BrandName } from "@/components/brand/brand-name";
import {
  AdminBottomNav,
  AdminSidebar,
  BookingLinkCard,
  NewAppointmentShortcut,
  SignOutButton,
} from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { getMyStudio, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const studio = await getMyStudio();
  const { count: pending } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("starts_at", new Date().toISOString());

  const bell = (
    <Link
      href="/admin#pendentes"
      className="relative flex size-10 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:bg-secondary"
      aria-label={pending ? `${pending} reservas pendentes` : "Nenhuma reserva pendente"}
    >
      <Bell className="size-5" />
      {!!pending && (
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold leading-4 text-white">
          {pending}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-7 overflow-y-auto bg-sidebar px-5 py-6 lg:flex">
        <BrandName name={studio.displayName || undefined} href="/admin" className="text-base" />
        <NewAppointmentShortcut />
        <AdminSidebar />
        <div className="mt-auto flex flex-col gap-3">
          <BookingLinkCard path={studio.publicPath} />
          <SignOutButton withLabel />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur sm:px-6">
          <span className="lg:hidden">
            <BrandName name={studio.displayName || undefined} href="/admin" className="text-sm" />
          </span>
          <form action="/admin/clientes" className="relative ml-auto hidden w-full max-w-xs md:block lg:ml-0" role="search">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            {bell}
            <ThemeToggle />
            <span className="lg:hidden">
              <SignOutButton />
            </span>
          </div>
        </header>
        <main className="w-full flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <AdminBottomNav />
    </div>
  );
}
