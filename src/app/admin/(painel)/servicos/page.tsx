import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/admin/page-header";
import { ServicesManager } from "@/components/admin/services-manager";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const { supabase, professionalId } = await requireAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes, is_active")
    .eq("professional_id", professionalId)
    .order("sort_order")
    .order("name");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Serviços" description="Crie, edite preços e escolha o que aparece para as clientes." />
      {error ? <Alert variant="destructive">Não foi possível carregar os serviços.</Alert> : <ServicesManager services={data ?? []} />}
    </div>
  );
}
