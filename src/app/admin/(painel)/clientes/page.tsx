import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { formatPhone } from "@/lib/format";

export const metadata = { title: "Clientes" };

const PAGE_SIZE = 50;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { q = "", pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const { supabase } = await requireAdmin();

  const term = q.trim().slice(0, 80);
  let query = supabase
    .from("clients")
    .select("id, full_name, phone, appointments(count)", { count: "exact" })
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (term) {
    const digits = term.replace(/\D/g, "");
    // Remove curingas e caracteres especiais da sintaxe de filtro do PostgREST.
    const safe = term.replace(/[%_*\\,()"'.:]/g, " ").replace(/\s+/g, " ").trim();
    query =
      digits.length >= 3
        ? query.or(`full_name.ilike.*${safe || digits}*,phone.like.*${digits}*`)
        : query.ilike("full_name", `%${safe}%`);
  }

  const { data, count, error } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Clientes" description={count != null ? `${count} cliente${count === 1 ? "" : "s"}` : undefined} />

      <form className="mb-5 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={term} placeholder="Buscar por nome ou telefone" className="pl-12" aria-label="Buscar cliente" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      {error ? (
        <Alert variant="destructive">Não foi possível carregar as clientes.</Alert>
      ) : !data?.length ? (
        <EmptyState icon={<Users />} title={term ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"}>
          {term ? "Tente outro nome ou telefone." : "As clientes aparecem aqui após o primeiro agendamento."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
          {data.map((c) => {
            const total = (c.appointments as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-primary" aria-hidden>
                    {c.full_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.full_name}</span>
                    <span className="text-sm text-muted-foreground">{formatPhone(c.phone)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {total} agend.
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Paginação">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/clientes?q=${encodeURIComponent(term)}&pagina=${page - 1}`}>Anterior</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/clientes?q=${encodeURIComponent(term)}&pagina=${page + 1}`}>Próxima</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
