// Dispara 20 reservas SIMULTÂNEAS para o mesmo horário, em conexões separadas.
// Esperado: exatamente 1 sucesso e 19 recusas SLOT_TAKEN.
import pg from "pg";

const url = process.argv[2];
const ATTEMPTS = 20;

const setup = new pg.Client({ connectionString: url });
await setup.connect();
const { rows } = await setup.query(`
  select s.id as service_id, s.professional_id,
         ((d::date + time '13:00') at time zone 'America/Sao_Paulo') as starts_at
  from public.services s,
       generate_series((now() at time zone 'America/Sao_Paulo')::date + 15,
                       (now() at time zone 'America/Sao_Paulo')::date + 22, '1 day') d
  where s.name = 'Manicure' and s.professional_id = (select id from public.professionals where is_primary) and extract(dow from d) = 3
  limit 1`);
const { service_id, professional_id, starts_at } = rows[0];
await setup.end();

const clients = await Promise.all(
  Array.from({ length: ATTEMPTS }, async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("set role anon");
    return c;
  }),
);

const results = await Promise.allSettled(
  clients.map((c, i) =>
    c.query("select * from public.create_public_booking($1::uuid, $2::uuid, $3::timestamptz, $4, $5)", [
      professional_id,
      service_id,
      starts_at,
      `Cliente Teste ${i}`,
      `1197000${String(1000 + i)}`,
    ]),
  ),
);
await Promise.all(clients.map((c) => c.end()));

const ok = results.filter((r) => r.status === "fulfilled").length;
const taken = results.filter((r) => r.status === "rejected" && r.reason.message === "SLOT_TAKEN").length;
const other = results.filter((r) => r.status === "rejected" && r.reason.message !== "SLOT_TAKEN");

console.log(`concorrência: ${ok} sucesso, ${taken} SLOT_TAKEN, ${other.length} outros erros`);
if (ok !== 1 || taken !== ATTEMPTS - 1) {
  other.forEach((r) => console.error(r.reason.message));
  console.error("FALHOU: reservas simultâneas não foram bloqueadas corretamente");
  process.exit(1);
}
console.log("ok - apenas uma reserva simultânea foi aceita");
