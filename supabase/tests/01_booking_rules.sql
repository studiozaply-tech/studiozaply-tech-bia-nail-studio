-- Testes das regras críticas do banco. Rodar com: npm run test:db
-- Usa o stub 00_supabase_stub.sql (PostgreSQL local, nunca o projeto real).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.expect_error(p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FALHOU: esperava erro % mas o comando passou: %', p_expected, p_sql;
exception
  when others then
    if sqlerrm like 'FALHOU:%' then raise; end if;
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'FALHOU: esperava %, recebeu %', p_expected, sqlerrm;
    end if;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FALHOU: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;

set client_min_messages = notice;

-- Preparação (como dono do banco) -------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'outra@teste.local');
insert into public.profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Sem permissão', 'staff');

insert into public.available_slots (weekday, start_time)
select d, t::time from generate_series(1, 6) d, unnest(array['13:00', '14:30', '16:00']) t;
-- Domingo também recebe um horário: deve continuar indisponível (dia fechado).
insert into public.available_slots (weekday, start_time) values (0, '14:30');
-- Fora do expediente (13h-18h): deve ser ignorado.
insert into public.available_slots (weekday, start_time) values (1, '19:00');

-- Datas de teste: próxima segunda, terça e próximo domingo (> 1 dia à frente)
create temp table t as
select
  d_mon,
  d_mon + 1 as d_tue,
  d_mon + 6 as d_sun,
  ((d_mon + time '14:30') at time zone 'America/Sao_Paulo') as slot_mon_1430,
  ((d_mon + time '16:00') at time zone 'America/Sao_Paulo') as slot_mon_1600,
  ((d_mon + 1 + time '13:00') at time zone 'America/Sao_Paulo') as slot_tue_1300,
  ((d_mon + 1 + time '14:30') at time zone 'America/Sao_Paulo') as slot_tue_1430,
  ((d_mon + 1 + time '16:00') at time zone 'America/Sao_Paulo') as slot_tue_1600
from (
  select d::date as d_mon
  from generate_series((now() at time zone 'America/Sao_Paulo')::date + 2,
                       (now() at time zone 'America/Sao_Paulo')::date + 9, '1 day') d
  where extract(dow from d) = 1 limit 1
) x;
grant select on t to anon, authenticated;

-- 1. Visitante -------------------------------------------------------
set role anon;
select pg_temp.check((select count(*) = 10 from public.services), 'visitante vê os 10 serviços ativos');
select pg_temp.expect_error('select * from public.clients', 'permission denied');
select pg_temp.expect_error('select * from public.appointments', 'permission denied');
select pg_temp.expect_error('select * from public.schedule_blocks', 'permission denied');
select pg_temp.expect_error($$update public.services set price_cents = 1$$, 'permission denied');
select pg_temp.check((select count(*) = 3 from public.get_available_slots((select d_mon from t))),
  'segunda tem 3 horários (19h fora do expediente é ignorado)');
select pg_temp.check((select count(*) = 0 from public.get_available_slots((select d_sun from t))),
  'domingo fechado não tem horários');
select pg_temp.check(
  (select (select d_sun from t) not in (select * from public.get_available_dates((select d_mon from t), (select d_sun from t)))),
  'domingo não aparece no calendário');

-- 2. Reserva pública --------------------------------------------------
select pg_temp.check((
  select b.service_price_cents = 13000 and b.status = 'pending'
  from public.create_public_booking(
    (select id from public.services where name = 'Fibra'),
    (select slot_mon_1430 from t), 'Maria da Silva', '(11) 98765-4321', 'Primeira vez') b
), 'reserva pública criada como pendente com preço da Fibra');

select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '11912345678')$$,
  (select id from public.services where name = 'Manicure'), (select slot_mon_1430 from t)), 'SLOT_TAKEN');

select pg_temp.check((select count(*) = 2 from public.get_available_slots((select d_mon from t))),
  'horário reservado sai da lista de disponíveis');

select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '123')$$,
  (select id from public.services where name = 'Manicure'), (select slot_mon_1600 from t)), 'INVALID_PHONE');
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'A', '11912345678')$$,
  (select id from public.services where name = 'Manicure'), (select slot_mon_1600 from t)), 'INVALID_NAME');
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '11912345678')$$,
  (select id from public.services where name = 'Manicure'),
  (select slot_mon_1600 from t) + interval '10 minutes'), 'SLOT_UNAVAILABLE');
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, now() - interval '1 day', 'Ana Souza', '11912345678')$$,
  (select id from public.services where name = 'Manicure')), 'SLOT_UNAVAILABLE');
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '11912345678')$$,
  gen_random_uuid(), (select slot_mon_1600 from t)), 'SERVICE_UNAVAILABLE');
reset role;

-- 3. Usuária autenticada sem perfil admin ------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.check((select count(*) = 0 from public.appointments), 'não-admin não vê agendamentos');
select pg_temp.check((select count(*) = 0 from public.clients), 'não-admin não vê clientes');
select pg_temp.expect_error(format(
  $$select public.admin_set_appointment_status(%L, 'cancelled')$$,
  (select id from public.appointments limit 1)), 'NOT_ALLOWED');
reset role;

-- 4. Admin -------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select pg_temp.check((select count(*) = 1 from public.appointments), 'admin vê o agendamento');

-- Alterar preço não altera o agendamento já feito
update public.services set price_cents = 15000 where name = 'Fibra';
select pg_temp.check((select service_price_cents = 13000 from public.appointments limit 1),
  'preço do agendamento preservado após mudança de preço');

-- Admin não pode criar no mesmo horário
select pg_temp.expect_error(format(
  $$select public.admin_create_appointment(%L, %L, 'Carla Dias', '21999998888')$$,
  (select id from public.services where name = 'Pedicure'), (select slot_mon_1430 from t)), 'SLOT_TAKEN');

-- Transições inválidas
select pg_temp.expect_error(format(
  $$select public.admin_set_appointment_status(%L, 'completed')$$,
  (select id from public.appointments limit 1)), 'INVALID_TRANSITION');

-- Remarcar para horário livre funciona; para horário ocupado falha
select public.admin_create_appointment(
  (select id from public.services where name = 'Pedicure'), (select slot_tue_1300 from t),
  'Carla Dias', '21999998888');
select pg_temp.expect_error(format(
  $$select public.admin_reschedule_appointment(%L, %L)$$,
  (select id from public.appointments where client_phone = '11987654321'), (select slot_tue_1300 from t)), 'SLOT_TAKEN');
select public.admin_reschedule_appointment(
  (select id from public.appointments where client_phone = '11987654321'), (select slot_mon_1600 from t));
select pg_temp.check((select count(*) = 2 from public.get_available_slots((select d_mon from t))),
  'remarcação liberou 14:30 e ocupou 16:00');

-- Cancelamento libera o horário
select public.admin_set_appointment_status(
  (select id from public.appointments where client_phone = '11987654321'), 'cancelled', 'Cliente pediu');
select pg_temp.check((select count(*) = 3 from public.get_available_slots((select d_mon from t))),
  'cancelamento liberou o horário');
select pg_temp.expect_error(format(
  $$select public.admin_set_appointment_status(%L, 'confirmed')$$,
  (select id from public.appointments where client_phone = '11987654321')), 'INVALID_TRANSITION');

-- Bloqueio de dia inteiro
insert into public.schedule_blocks (starts_at, ends_at, all_day, reason)
select (d_tue + time '00:00') at time zone 'America/Sao_Paulo',
       (d_tue + 1 + time '00:00') at time zone 'America/Sao_Paulo', true, 'Curso'
from t;
select pg_temp.check((select count(*) = 0 from public.get_available_slots((select d_tue from t))),
  'dia bloqueado não tem horários');
select pg_temp.expect_error(format(
  $$select public.admin_create_appointment(%L, %L, 'Carla Dias', '21999998888')$$,
  (select id from public.services where name = 'Pedicure'), (select slot_tue_1600 from t)), 'SLOT_BLOCKED');

-- Histórico
select pg_temp.check((
  select array_agg(h.action order by h.id) = array['created', 'rescheduled', 'status_changed']
  from public.appointment_history h
  join public.appointments a on a.id = h.appointment_id
  where a.client_phone = '11987654321'
), 'histórico registra criação, remarcação e cancelamento');
select pg_temp.check((select count(*) > 0 from public.change_log where table_name = 'services'),
  'alteração de preço registrada no change_log');
reset role;

-- 5. Visitante tenta reservar horário bloqueado ------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '11912345678')$$,
  (select id from public.services where name = 'Manicure'), (select slot_tue_1430 from t)), 'SLOT_UNAVAILABLE');

-- Limite de reservas ativas por telefone (padrão 3)
select * from public.create_public_booking((select id from public.services where name = 'Manicure'),
  (select slot_mon_1430 from t), 'Ana Souza', '11912345678');
select * from public.create_public_booking((select id from public.services where name = 'Manicure'),
  (select slot_mon_1430 from t) + interval '7 days', 'Ana Souza', '11912345678');
select * from public.create_public_booking((select id from public.services where name = 'Manicure'),
  (select slot_mon_1600 from t) + interval '7 days', 'Ana Souza', '11912345678');
select pg_temp.expect_error(format(
  $$select * from public.create_public_booking(%L, %L, 'Ana Souza', '11912345678')$$,
  (select id from public.services where name = 'Manicure'),
  (select slot_mon_1430 from t) + interval '8 days'), 'TOO_MANY_BOOKINGS');
reset role;

select pg_temp.check(true, 'TODOS OS TESTES DE REGRA PASSARAM');
