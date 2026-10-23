import { describe, expect, it } from "vitest";
import { formatPhone, formatPrice, maskPhoneInput, normalizePhone, parsePriceToCents } from "../format";
import { publicBookingSchema } from "../validation";
import { dbErrorCode, dbErrorMessage, SLOT_TAKEN_MESSAGE } from "../errors";

describe("formatação", () => {
  it("formata preços em reais", () => {
    expect(formatPrice(13000)).toBe("R$ 130,00");
    expect(formatPrice(5000)).toBe("R$ 50,00");
  });

  it("interpreta preços digitados", () => {
    expect(parsePriceToCents("130,00")).toBe(13000);
    expect(parsePriceToCents("R$ 1.300,50")).toBe(130050);
    expect(parsePriceToCents("90")).toBe(9000);
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("1,234")).toBeNull();
  });

  it("normaliza telefones brasileiros", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("11987654321");
    expect(normalizePhone("+55 11 98765-4321")).toBe("11987654321");
    expect(normalizePhone("1133334444")).toBe("1133334444");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("01987654321")).toBeNull();
  });

  it("mascara e exibe telefones", () => {
    expect(maskPhoneInput("11987654321")).toBe("(11) 98765-4321");
    expect(maskPhoneInput("119")).toBe("(11) 9");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });
});

describe("validação da reserva no servidor", () => {
  const base = {
    professionalId: "3c8e2a41-0d7b-4e2f-9a5c-6b1d2e3f4a5b",
    serviceId: "7b1f7b52-6a3c-4f55-9d2e-2a7b0f5f9d11",
    startsAt: "2026-10-26T16:00:00.000Z",
    fullName: "  Maria   da Silva ",
    phone: "(11) 98765-4321",
    notes: "",
  };

  it("aceita e normaliza dados válidos", () => {
    const r = publicBookingSchema.parse(base);
    expect(r.fullName).toBe("Maria da Silva");
    expect(r.phone).toBe("11987654321");
    expect(r.notes).toBeNull();
  });

  it("recusa dados inválidos", () => {
    expect(publicBookingSchema.safeParse({ ...base, fullName: "A" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, phone: "999" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, startsAt: "amanhã" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, serviceId: "x" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, professionalId: "x" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("mensagens de erro do banco", () => {
  it("traduz horário ocupado com a mensagem exigida", () => {
    expect(dbErrorCode({ message: "SLOT_TAKEN", code: "P0001" })).toBe("SLOT_TAKEN");
    expect(dbErrorMessage({ message: "SLOT_TAKEN" })).toBe(SLOT_TAKEN_MESSAGE);
    expect(SLOT_TAKEN_MESSAGE).toBe("Esse horário já está marcado!\nEscolha outro horário disponível para continuar.");
  });

  it("não vaza erros internos", () => {
    expect(dbErrorMessage({ message: 'relation "x" does not exist' })).toBe("Algo deu errado. Tente novamente em instantes.");
  });
});
