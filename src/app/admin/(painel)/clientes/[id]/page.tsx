import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/admin/appointment-card";
import { ClientForm } from "@/components/admin/client-form";
import { NewAppointmentButton } from "@/components/admin/appointment-dialogs";
import { EmptyState } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_APPOINTMENT_FIELDS } from "@/lib/data/admin-types";
import { formatDateShort, toDateKey } from "@/lib/datetime";
import { formatPhone, formatPrice } from "@/lib/format";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Cliente" };

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();

  const [clientRes, apptRes, servicesRes] = await Promise.all([
    supabase.from("clients").select("id, full_name, phone, admin_notes, created_at").eq("id", id).maybeSingle(),
    supabase.from("appointments").select(ADMIN_APPOINTMENT_FIELDS).eq("client_id", id).order("starts_at", { ascending: false }),
    supabase.from("services").select("id, name, price_cents, is_active").order("sort_order"),
  ]);
  if (!clientRes.data) notFound();
  const client = clientRes.data;
  const appts = apptRes.data ?? [];
  const now = Date.now();
  const upcoming = appts.filter((a) => new Date(a.starts_at).getTime() >= now && a.status !== "cancelled").reverse();
  const past = appts.filter((a) => !upcoming.includes(a));
  const completed = appts.filter((a) => a.status === "completed");
  const spent = completed.reduce((s, a) => s + a.service_price_cents, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/admin/clientes">
          <ArrowLeft /> Clientes
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary-dark">{client.full_name}</h1>
          <a href={`tel:${client.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary">
            <Phone className="size-4" aria-hidden /> {formatPhone(client.phone)}
          </a>
        </div>
        <NewAppointmentButton services={servicesRes.data ?? []} defaultClient={{ fullName: client.full_name, phone: client.phone }} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Agendamentos", String(appts.length)],
          ["Concluídos", String(completed.length)],
          ["Total gasto", formatPrice(spent)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xl font-bold text-primary-dark sm:text-2xl">{value}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-primary-dark">Próximos</h2>
            {upcoming.length ? (
              <div className="flex flex-col gap-3">
                {upcoming.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} showDate />
                ))}
              </div>
            ) : (
              <EmptyState icon={<CalendarDays />} title="Nenhum agendamento futuro" />
            )}
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold text-primary-dark">Histórico</h2>
            {past.length ? (
              <div className="flex flex-col gap-3">
                {past.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} showDate />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
            )}
          </div>
        </section>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Dados de contato</CardTitle>
            <p className="text-sm text-muted-foreground">Cliente desde {formatDateShort(toDateKey(client.created_at))}</p>
          </CardHeader>
          <CardContent>
            <ClientForm client={client} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
