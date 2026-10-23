/**
 * Datas e horários sempre no fuso do estúdio (America/Sao_Paulo),
 * independentemente do fuso do servidor ou do aparelho da cliente.
 * "DateKey" = data local no formato YYYY-MM-DD.
 */
export const STUDIO_TZ = "America/Sao_Paulo";

export type DateKey = string;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateKey(value: string): value is DateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isTimeKey(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Data local (São Paulo) de um instante. */
export function toDateKey(date: Date | string): DateKey {
  const p = zonedParts(typeof date === "string" ? new Date(date) : date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Hora local (São Paulo) de um instante, HH:MM. */
export function toTimeKey(date: Date | string) {
  const p = zonedParts(typeof date === "string" ? new Date(date) : date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** Converte data + hora locais de São Paulo para um instante ISO (UTC). */
export function zonedToUtcIso(dateKey: DateKey, time = "00:00"): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = asUtc;
  // Duas iterações resolvem mudanças de offset (horário de verão, se voltar a existir).
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
    guess = asUtc - offset;
  }
  return new Date(guess).toISOString();
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = domingo ... 6 = sábado (mesmo padrão do banco). */
export function weekdayOf(dateKey: DateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeek(dateKey: DateKey): DateKey {
  const wd = weekdayOf(dateKey);
  return addDays(dateKey, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(dateKey: DateKey): DateKey {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonths(dateKey: DateKey, months: number): DateKey {
  const [y, m] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
}

export function daysInMonth(dateKey: DateKey) {
  const [y, m] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Grade do mês começando na segunda-feira; null = célula vazia. */
export function monthGrid(monthKey: DateKey): (DateKey | null)[] {
  const first = startOfMonth(monthKey);
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: (DateKey | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < daysInMonth(first); i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function keyToNoonUtc(dateKey: DateKey) {
  return new Date(`${dateKey}T12:00:00Z`);
}

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sexta-feira, 23 de outubro" */
export function formatDateLong(dateKey: DateKey) {
  return capitalizeFirst(new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    keyToNoonUtc(dateKey),
  ));
}

export function formatDateShort(dateKey: DateKey) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    keyToNoonUtc(dateKey),
  );
}

export function formatMonthYear(dateKey: DateKey) {
  return capitalizeFirst(new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(keyToNoonUtc(dateKey)));
}

export function formatWeekdayShort(dateKey: DateKey) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(keyToNoonUtc(dateKey))
    .replace(".", "");
}

export function formatDateTime(iso: string) {
  return `${formatDateShort(toDateKey(iso))} às ${toTimeKey(iso)}`;
}

export const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
export const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"]; // começando na segunda
