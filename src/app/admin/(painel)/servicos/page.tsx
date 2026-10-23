import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/admin/page-header";
import { ServicesManager } from "@/components/admin/services-manager";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes, is_active")
    .order("sort_order")
    .order("name");

  return (
    <>
      <PageHeader title="Serviços" description="Crie, edite preços e escolha o que aparece para as clientes." />
      {error ? <Alert variant="destructive">Não foi possível carregar os serviços.</Alert> : <ServicesManager services={data ?? []} />}
    </>
  );
}
