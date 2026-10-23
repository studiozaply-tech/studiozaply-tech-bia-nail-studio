import Link from "next/link";
import { ChevronLeft, ChevronRight, Coffee, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { addMonths, formatMonthYear, monthGrid, todayKey, WEEKDAY_INITIALS, type DateKey } from "@/lib/datetime";

/* Componentes visuais do dashboard (SVG puro, sem biblioteca de gráficos). */

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-3xl bg-card p-5 shadow-sm shadow-primary/5", className)}>{children}</section>;
}

export function PanelTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

/* ---------------------------- Ilustração do topo --------------------------- */

export function NailIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <defs>
        <linearGradient id="ni-bottle" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
        <linearGradient id="ni-soft" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f6c7ea" />
          <stop offset="1" stopColor="#d9a6f0" />
        </linearGradient>
      </defs>
      {/* cartões flutuantes */}
      <g className="origin-center animate-[float_6s_ease-in-out_infinite]">
        <rect x="18" y="20" width="30" height="30" rx="7" fill="#fff" opacity=".9" transform="rotate(-10 33 35)" />
        <rect x="24" y="30" width="18" height="3" rx="1.5" fill="#e05bbf" transform="rotate(-10 33 35)" />
        <rect x="24" y="37" width="12" height="3" rx="1.5" fill="#c58add" transform="rotate(-10 33 35)" />
      </g>
      <rect x="58" y="62" width="26" height="26" rx="7" fill="url(#ni-bottle)" transform="rotate(8 71 75)" />
      <rect x="64" y="70" width="14" height="3" rx="1.5" fill="#fff" transform="rotate(8 71 75)" />
      <rect x="64" y="76" width="9" height="3" rx="1.5" fill="#fff" opacity=".8" transform="rotate(8 71 75)" />
      <rect x="28" y="98" width="22" height="22" rx="6" fill="#efe1f7" transform="rotate(-6 39 109)" />
      <rect x="100" y="10" width="22" height="26" rx="6" fill="#f9a8d4" transform="rotate(12 111 23)" />
      <rect x="105" y="17" width="12" height="3" rx="1.5" fill="#fff" transform="rotate(12 111 23)" />
      {/* esmalte */}
      <rect x="150" y="18" width="22" height="44" rx="6" fill="#4a145a" />
      <rect x="146" y="58" width="30" height="8" rx="3" fill="#2b0b35" />
      <path d="M140 66h42a10 10 0 0 1 10 10v44a14 14 0 0 1-14 14h-34a14 14 0 0 1-14-14V76a10 10 0 0 1 10-10Z" fill="url(#ni-bottle)" />
      <path d="M146 76h6v44h-6z" fill="#fff" opacity=".35" rx="3" />
      <rect x="149" y="96" width="24" height="18" rx="4" fill="#fff" opacity=".9" />
      <path d="M156 101l4 8 4-8" stroke="#8e35a8" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* gota e brilhos */}
      <path d="M200 92c0 5-3 8-6 8s-6-3-6-8 6-12 6-12 6 7 6 12Z" fill="url(#ni-soft)" />
      <path d="M205 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#e05bbf" />
      <path d="M128 112l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="#c58add" />
    </svg>
  );
}

/* ------------------------------ Número em destaque ------------------------- */

export function StatTile({ value, label, href, seed = 0 }: { value: number | string; label: string; href?: string; seed?: number }) {
  const bars = [0.35, 0.7, 0.5, 0.9, 0.6].map((h, i) => 0.25 + ((h + seed * 0.17 * (i + 1)) % 0.75));
  const content = (
    <div className="flex h-full flex-col items-start gap-2 rounded-3xl bg-card px-4 py-4 shadow-sm shadow-primary/5 transition-transform hover:-translate-y-0.5 2xl:flex-row 2xl:items-center 2xl:gap-3">
      <svg viewBox="0 0 34 30" className="h-6 w-7 shrink-0" aria-hidden>
        {bars.map((h, i) => (
          <rect key={i} x={i * 7} y={30 - h * 30} width="3" height={h * 30} rx="1.5" fill="var(--brand-to)" opacity={0.45 + i * 0.12} />
        ))}
      </svg>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-3xl">
      {content}
    </Link>
  ) : (
    content
  );
}

/* --------------------------------- Anel ----------------------------------- */

export function ProgressRing({ value, size = 120, stroke = 10, label, sublabel }: { value: number; size?: number; stroke?: number; label: string; sublabel?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${size}`} x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-from)" />
            <stop offset="1" stopColor="var(--brand-to)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn("font-semibold text-foreground tabular-nums", size >= 100 ? "text-2xl" : "text-[11px]")}>{label}</span>
        {sublabel && <span className="max-w-[70%] text-[11px] leading-tight text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------- Gráfico de atividade (linha) -------------------- */

export function ActivityChart({ days }: { days: { key: DateKey; label: string; count: number; isToday: boolean }[] }) {
  const W = 560;
  const H = 150;
  const padX = 20;
  const top = 26;
  const bottom = 18;
  const max = Math.max(3, ...days.map((d) => d.count));
  const pts = days.map((d, i) => ({
    x: padX + (i * (W - padX * 2)) / (days.length - 1),
    y: top + (1 - d.count / max) * (H - top - bottom),
    ...d,
  }));
  // Curva suave (Catmull-Rom -> Bézier)
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const today = pts.find((p) => p.isToday);

  return (
    <div>
      <div className="relative h-40">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Atendimentos por dia nesta semana">
          <defs>
            <linearGradient id="act-line" x1="0" x2="1">
              <stop offset="0" stopColor="var(--brand-from)" />
              <stop offset="1" stopColor="var(--brand-to)" />
            </linearGradient>
            <linearGradient id="act-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--brand-to)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--brand-to)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={top + f * (H - top - bottom)} y2={top + f * (H - top - bottom)} stroke="var(--chart-grid)" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="url(#act-fill)" />
          <path d={path} fill="none" stroke="url(#act-line)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {today && <line x1={today.x} x2={today.x} y1={today.y} y2={H} stroke="var(--brand-to)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />}
        </svg>
        {today && (
          <>
            <span
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-brand-to bg-card"
              style={{ left: `${(today.x / W) * 100}%`, top: `${(today.y / H) * 100}%` }}
              aria-hidden
            />
            <span
              className="absolute -translate-x-1/2 rounded-md border border-brand-to/40 bg-card px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-primary shadow-sm"
              style={{ left: `${(today.x / W) * 100}%`, top: `calc(${(today.y / H) * 100}% - 34px)` }}
            >
              {today.count} {today.count === 1 ? "atendimento" : "atendimentos"}
            </span>
          </>
        )}
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs">
        {days.map((d) => (
          <Link key={d.key} href={`/admin/agenda?visao=dia&data=${d.key}`} className={cn("rounded-lg py-1", d.isToday ? "font-bold text-foreground" : "text-muted-foreground hover:text-primary")}>
            {d.isToday && <span className="block text-sm">{Number(d.key.slice(8))}</span>}
            {d.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Faturamento (barras) -------------------------- */

export function RevenueBars({ days }: { days: { key: DateKey; label: string; cents: number; isToday: boolean }[] }) {
  const max = Math.max(1, ...days.map((d) => d.cents));
  return (
    <div className="grid grid-cols-7 gap-2" role="img" aria-label="Valor dos atendimentos por dia nesta semana">
      {days.map((d) => (
        <div key={d.key} className="flex flex-col items-center gap-2">
          <div className="relative flex h-28 w-full max-w-9 items-end overflow-hidden rounded-xl bg-secondary" title={formatPrice(d.cents)}>
            <div
              className="w-full rounded-xl bg-[linear-gradient(180deg,var(--brand-to),var(--brand-from))] transition-[height] duration-700"
              style={{ height: `${d.cents ? Math.max(8, (d.cents / max) * 100) : 0}%` }}
            />
          </div>
          <span className={cn("text-xs", d.isToday ? "font-bold text-foreground" : "text-muted-foreground")}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Mini calendário ----------------------------- */

export function MiniCalendar({ month, busyDays }: { month: DateKey; busyDays: Set<string> }) {
  const today = todayKey();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{formatMonthYear(month)}</p>
        <div className="flex gap-1">
          <Link href={`/admin/agenda?visao=mes&data=${addMonths(month, -1)}`} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary" aria-label="Mês anterior">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={`/admin/agenda?visao=mes&data=${addMonths(month, 1)}`} className="rounded-lg p-1 text-foreground hover:bg-secondary" aria-label="Próximo mês">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={i} className="pb-1 font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {monthGrid(month).map((d, i) =>
          d ? (
            <Link
              key={d}
              href={`/admin/agenda?visao=dia&data=${d}`}
              className={cn(
                "relative mx-auto flex size-7 items-center justify-center rounded-full tabular-nums transition-colors hover:bg-secondary",
                d === today && "bg-brand-gradient font-bold text-white hover:bg-none",
              )}
            >
              {Number(d.slice(8))}
              {busyDays.has(d) && d !== today && <span className="absolute bottom-0.5 size-1 rounded-full bg-brand-to" />}
            </Link>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Linha do tempo do dia ------------------------ */

export type TimelineItem = { id: string; start: string; end: string; title: string; subtitle: string; href: string; tone: "pending" | "confirmed" | "done" };

export function DayTimeline({ from, to, items }: { from: number; to: number; items: TimelineItem[] }) {
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const rowH = 44;
  const toY = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h - from + m / 60) * rowH;
  };
  return (
    <div className="relative" style={{ height: hours.length * rowH }}>
      {hours.map((h, i) => (
        <div key={h} className="absolute inset-x-0 flex items-start gap-3" style={{ top: i * rowH }}>
          <span className="w-10 shrink-0 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">{String(h).padStart(2, "0")}:00</span>
          <span className="mt-0 h-px flex-1 bg-chart-grid" />
        </div>
      ))}
      {items.map((it, idx) => {
        const top = toY(it.start);
        const height = Math.max(34, toY(it.end) - top - 4);
        return (
          <Link
            key={it.id}
            href={it.href}
            className={cn(
              "absolute flex items-center gap-2 overflow-hidden rounded-xl border bg-card px-2 py-1 text-left shadow-sm transition-transform hover:-translate-y-0.5",
              it.tone === "pending" ? "border-warning/50" : it.tone === "done" ? "border-success/50" : "border-brand-to/50",
            )}
            style={{ top: top + 2, height, left: `calc(3.25rem + ${(idx % 2) * 12}%)`, right: `${((idx + 1) % 2) * 8}%` }}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
              {it.tone === "done" ? <Coffee className="size-3.5" /> : <Sparkles className="size-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">{it.title}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{it.subtitle}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl bg-brand-gradient font-semibold text-white", className)} aria-hidden>
      {initials}
    </span>
  );
}
