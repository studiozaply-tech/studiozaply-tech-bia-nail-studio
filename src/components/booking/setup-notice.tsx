import { AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

export function SetupNotice({ message }: { message?: string }) {
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden />
      <div>
        <p className="font-semibold">Não foi possível carregar os dados agora.</p>
        <p className="mt-1">{message ?? "Atualize a página em alguns instantes."}</p>
      </div>
    </Alert>
  );
}
