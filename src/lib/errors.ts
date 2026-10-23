/** Mensagens amigáveis para os códigos de erro das funções do banco. */
export const SLOT_TAKEN_MESSAGE = "Esse horário já está marcado!\nEscolha outro horário disponível para continuar.";

const MESSAGES: Record<string, string> = {
  SLOT_TAKEN: SLOT_TAKEN_MESSAGE,
  SLOT_UNAVAILABLE: "Esse horário não está mais disponível.\nEscolha outro horário para continuar.",
  SLOT_BLOCKED: "Esse horário está bloqueado na agenda. Remova o bloqueio ou escolha outro horário.",
  SERVICE_UNAVAILABLE: "Este serviço não está disponível no momento. Escolha outro serviço.",
  INVALID_NAME: "Digite seu nome completo.",
  INVALID_PHONE: "Digite um telefone com DDD. Ex.: (11) 91234-5678",
  INVALID_NOTES: "A observação pode ter até 500 caracteres.",
  INVALID_PRICE: "Preço inválido.",
  INVALID_STATUS: "Status inválido.",
  INVALID_TRANSITION: "Essa ação não é permitida para o status atual do agendamento.",
  TOO_MANY_BOOKINGS: "Você já tem reservas em aberto. Para marcar outra, fale com a profissional.",
  NOT_ALLOWED: "Você não tem permissão para fazer isso.",
  NOT_FOUND: "Agendamento não encontrado.",
  INVALID_RANGE: "Período inválido.",
  TOO_MANY_REQUESTS: "Muitas tentativas agora. Tente de novo em alguns minutos.",
};

export const GENERIC_ERROR = "Algo deu errado. Tente novamente em instantes.";

export type DbErrorCode = keyof typeof MESSAGES;

export function dbErrorCode(error: { message?: string; code?: string } | null | undefined): string | null {
  if (!error?.message) return null;
  const code = error.message.trim();
  if (code in MESSAGES) return code;
  if (error.code === "42501") return "NOT_ALLOWED";
  return null;
}

export function dbErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback = GENERIC_ERROR) {
  const code = dbErrorCode(error);
  return code ? MESSAGES[code] : fallback;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
