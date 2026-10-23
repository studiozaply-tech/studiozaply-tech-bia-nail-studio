import { describe, expect, it } from "vitest";
import { addDays, addMonths, isDateKey, monthGrid, startOfWeek, toDateKey, toTimeKey, weekdayOf, zonedToUtcIso } from "../datetime";

describe("datetime (America/Sao_Paulo)", () => {
  it("converte horário local de São Paulo para UTC", () => {
    expect(zonedToUtcIso("2026-10-26", "13:00")).toBe("2026-10-26T16:00:00.000Z");
    expect(zonedToUtcIso("2026-10-26")).toBe("2026-10-26T03:00:00.000Z");
  });

  it("lida com o horário de verão histórico (2018)", () => {
    // Em 2018-12-01 São Paulo estava em UTC-2.
    expect(zonedToUtcIso("2018-12-01", "13:00")).toBe("2018-12-01T15:00:00.000Z");
  });

  it("extrai data e hora locais de um instante UTC", () => {
    expect(toDateKey("2026-10-27T02:30:00Z")).toBe("2026-10-26");
    expect(toTimeKey("2026-10-26T16:00:00Z")).toBe("13:00");
  });

  it("faz ida e volta sem perder o horário", () => {
    const iso = zonedToUtcIso("2026-12-31", "17:30");
    expect(toDateKey(iso)).toBe("2026-12-31");
    expect(toTimeKey(iso)).toBe("17:30");
  });

  it("calcula dias, semanas e meses", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(weekdayOf("2026-10-25")).toBe(0); // domingo
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(startOfWeek("2026-10-19")).toBe("2026-10-19");
  });

  it("monta a grade do mês começando na segunda", () => {
    const grid = monthGrid("2026-10-01"); // 1º de outubro de 2026 é quinta
    expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(grid.length % 7).toBe(0);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it("valida datas", () => {
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("26-10-2026")).toBe(false);
  });
});
