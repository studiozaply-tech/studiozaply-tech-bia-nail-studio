import { AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

export function SetupNotice({ message }: { message?: string }) {
  const build = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF)?.slice(0, 7);
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden />
      <div>
        <p className="font-semibold">Não foi possível carregar os dados agora.</p>
        <p className="mt-1">{message ?? "Atualize a página em alguns instantes."}</p>
        {build ? <p className="mt-2 text-xs opacity-70">Versão {build}</p> : null}
      </div>
    </Alert>
  );
}
