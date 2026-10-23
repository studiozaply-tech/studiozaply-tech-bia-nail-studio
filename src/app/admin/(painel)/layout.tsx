import type { Metadata } from "next";
import { BrandName } from "@/components/brand/brand-name";
import { AdminBottomNav, AdminSidebar, SignOutButton } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-card p-5 lg:flex">
        <div>
          <BrandName href="/admin" />
          <p className="mt-1 text-xs text-muted-foreground">Painel da profissional</p>
        </div>
        <AdminSidebar />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur lg:hidden">
          <BrandName href="/admin" className="text-base" />
          <SignOutButton />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <AdminBottomNav />
    </div>
  );
}
