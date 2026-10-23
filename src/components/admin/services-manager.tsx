"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "./page-header";
import { saveServiceAction, toggleServiceAction } from "@/app/admin/actions";
import { centsToInput, formatPrice, parsePriceToCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Service = Pick<Tables<"services">, "id" | "name" | "description" | "price_cents" | "duration_minutes" | "is_active">;

export function ServicesManager({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Service | null | "new">(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> Novo serviço
        </Button>
      </div>
      {services.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="Nenhum serviço cadastrado" />
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} onEdit={() => setEditing(s)} />
          ))}
        </ul>
      )}
      {editing && (
        <ServiceDialog service={editing === "new" ? null : editing} open onOpenChange={(o) => !o && setEditing(null)} />
      )}
    </>
  );
}

function ServiceRow({ service: s, onEdit }: { service: Service; onEdit: () => void }) {
  const router = useRouter();
  const [active, setActive] = useState(s.is_active);
  const [pending, start] = useTransition();

  const toggle = (value: boolean) => {
    setActive(value); // resposta imediata; desfaz se o servidor recusar
    start(async () => {
      const res = await toggleServiceAction(s.id, value);
      if (!res.ok) {
        setActive(!value);
        toast.error(res.error);
        return;
      }
      toast.success(value ? `${s.name} está visível para as clientes.` : `${s.name} foi desativado.`);
      router.refresh();
    });
  };

  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 transition-opacity", !active && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{s.name}</p>
          {!active && <Badge variant="muted">Inativo</Badge>}
        </div>
        <p className="text-lg font-bold text-primary">{formatPrice(s.price_cents)}</p>
        {s.duration_minutes && <p className="text-xs text-muted-foreground">Cerca de {s.duration_minutes} min</p>}
      </div>
      <label className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <Switch checked={active} onCheckedChange={toggle} disabled={pending} aria-label={`${active ? "Desativar" : "Ativar"} ${s.name}`} />
        {active ? "Ativo" : "Inativo"}
      </label>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Editar ${s.name}`}>
        <Pencil />
      </Button>
    </li>
  );
}

function ServiceDialog({ service, open, onOpenChange }: { service: Service | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(service ? centsToInput(service.price_cents) : "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(service?.duration_minutes ? String(service.duration_minutes) : "");
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = parsePriceToCents(price);
    const durationMinutes = duration.trim() ? Number(duration) : null;
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Digite o nome do serviço.";
    if (priceCents === null) next.priceCents = "Digite um preço válido. Ex.: 130,00";
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720))
      next.durationMinutes = "Duração entre 5 e 720 minutos, ou deixe em branco.";
    setErrors(next);
    if (Object.keys(next).length) return;

    start(async () => {
      const res = await saveServiceAction(service?.id ?? null, {
        name,
        description,
        priceCents: priceCents!,
        durationMinutes,
        isActive,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? { form: res.error });
        return;
      }
      toast.success(service ? "Serviço atualizado!" : "Serviço criado!");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          <DialogDescription>Mudanças de preço valem para novos agendamentos. Os já feitos mantêm o preço original.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sv-name">Nome</Label>
            <Input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={Boolean(errors.name)} />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sv-price">Preço (R$)</Label>
              <Input id="sv-price" inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={Boolean(errors.priceCents)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sv-duration">
                Duração <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="sv-duration" inputMode="numeric" placeholder="min" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.durationMinutes)} />
            </div>
          </div>
          {(errors.priceCents || errors.durationMinutes) && (
            <p className="text-sm text-destructive">{errors.priceCents ?? errors.durationMinutes}</p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sv-desc">
              Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="sv-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-16" />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
            <span className="font-semibold text-secondary-foreground">Visível para as clientes</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
          {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
