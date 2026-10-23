import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types/database";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const VARIANT = {
  pending: "warning",
  confirmed: "primary",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
} as const;

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
