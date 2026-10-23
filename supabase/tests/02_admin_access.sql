-- Testes do acesso ao painel (primeiro acesso + e-mails liberados). Rodar com: npm run test:db
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.check(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FALHOU: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;

set client_min_messages = notice;

-- Banco limpo: nenhuma admin ainda.
delete from public.profiles;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Primeira@Teste.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'intrusa@teste.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'convidada@teste.local');

set role anon;
select pg_temp.check(not public.admin_exists(), 'sem admin: admin_exists = false');
reset role;

-- Primeira conta vira admin e é ligada à profissional.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check(public.claim_admin_access('Beatriz'), 'primeira conta vira admin');
select pg_temp.check(public.is_admin(), 'primeira conta é admin');
select pg_temp.check(public.claim_admin_access(null), 'admin chamando de novo continua admin');
reset role;
select pg_temp.check(
  (select user_id from public.professionals where is_primary) = '00000000-0000-0000-0000-0000000000c1',
  'profissional ligada à primeira admin');
select pg_temp.check((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'Beatriz',
  'nome gravado');

-- Segunda conta sem convite: não vira admin e não vê agendamentos.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.check(not public.claim_admin_access('Intrusa'), 'conta sem convite não vira admin');
select pg_temp.check(not public.is_admin(), 'conta sem convite segue sem acesso');
select pg_temp.check((select count(*) from public.appointments) = 0, 'conta sem convite não lê agendamentos');
select pg_temp.check((select count(*) from public.admin_invites) = 0, 'conta sem convite não lê convites');
reset role;

-- Admin libera um e-mail; a convidada vira admin e o convite é consumido.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into public.admin_invites (email) values ('convidada@teste.local');
select pg_temp.check((select count(*) from public.admin_invites) = 1, 'admin vê o convite');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $$ begin
  insert into public.admin_invites (email) values ('intrusa@teste.local');
  raise exception 'FALHOU: não admin conseguiu liberar e-mail';
exception when insufficient_privilege then null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select pg_temp.check(public.claim_admin_access('Convidada'), 'convidada vira admin');
reset role;
select pg_temp.check((select count(*) from public.admin_invites) = 0, 'convite consumido');
select pg_temp.check(
  (select user_id from public.professionals where is_primary) = '00000000-0000-0000-0000-0000000000c1',
  'profissional continua ligada à primeira admin');

set role anon;
select pg_temp.check(public.admin_exists(), 'com admin: admin_exists = true');
reset role;
