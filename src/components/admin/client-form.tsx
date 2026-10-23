"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClientAction } from "@/app/admin/actions";
import { maskPhoneInput } from "@/lib/format";

export function ClientForm({ client }: { client: { id: string; full_name: string; phone: string; admin_notes: string | null } }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(client.full_name);
  const [phone, setPhone] = useState(maskPhoneInput(client.phone));
  const [adminNotes, setAdminNotes] = useState(client.admin_notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateClientAction({ id: client.id, fullName, phone, adminNotes });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success("Dados da cliente salvos.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-name">Nome</Label>
        <Input id="c-name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={Boolean(errors.fullName)} />
        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-phone">Telefone</Label>
        <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} aria-invalid={Boolean(errors.phone)} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-notes">Anotações (só você vê)</Label>
        <Textarea id="c-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} maxLength={1000} placeholder="Preferências, alergias, formato de unha..." />
      </div>
      <Button type="submit" loading={pending} className="w-full sm:w-fit">
        Salvar dados
      </Button>
    </form>
  );
}
