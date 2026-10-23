-- =====================================================================
-- Bia Nail Studio · BEATRIZ ABREU
-- Estrutura inicial do banco de dados (Supabase PostgreSQL)
--
-- Regras centrais:
--   * Todo horário é gravado como timestamptz (UTC) e interpretado no
--     fuso America/Sao_Paulo.
--   * Um horário só pode ter UM agendamento ativo. Isso é garantido por
--     um índice único parcial no banco (não depende da interface).
--   * Agendamento cancelado libera o horário imediatamente.
--     Pendente, confirmado, concluído e "não compareceu" ocupam o horário.
--   * Visitantes (anon) não leem nem escrevem tabelas com dados pessoais.
--     O agendamento público acontece somente pela função
--     create_public_booking, que valida tudo no servidor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

create or replace function public.studio_timezone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'America/Sao_Paulo'::text $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normaliza telefone brasileiro para apenas dígitos (DDD + número).
-- Aceita "+55 (11) 91234-5678", "11912345678" etc. Retorna null se inválido.
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(v) in (12, 13) and left(v, 2) = '55' then
    v := substr(v, 3);
  end if;
  if v ~ '^[1-9][0-9][0-9]{8,9}$' then
    return v;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Usuários e profissionais
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Usuários do painel. Somente role = admin acessa dados administrativos.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  brand_name text not null check (char_length(trim(brand_name)) between 2 and 80),
  welcome_message text check (welcome_message is null or char_length(welcome_message) <= 300),
  user_id uuid references public.profiles (id) on delete set null,
  -- Regras do agendamento online
  min_advance_minutes integer not null default 60
    check (min_advance_minutes between 0 and 10080),
  booking_window_days integer not null default 60
    check (booking_window_days between 1 and 365),
  max_active_bookings_per_phone integer not null default 3
    check (max_active_bookings_per_phone between 1 and 20),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Esta versão atende uma única profissional.
create unique index professionals_single_primary on public.professionals (is_primary)
  where is_primary;

create trigger professionals_updated_at before update on public.professionals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 300),
  price_cents integer not null check (price_cents between 0 and 10000000),
  -- Duração é opcional: os atendimentos variam de cliente para cliente.
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 720),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index services_name_unique on public.services (lower(trim(name)));

create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 3 and 120),
  phone text not null unique check (phone ~ '^[1-9][0-9][0-9]{8,9}$'),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_name_search on public.clients (lower(full_name));

create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Horários de funcionamento e horários disponíveis
-- ---------------------------------------------------------------------

-- weekday segue extract(dow): 0 = domingo, 1 = segunda ... 6 = sábado
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default false,
  open_time time,
  close_time time,
  updated_at timestamptz not null default now(),
  check (not is_open or (open_time is not null and close_time is not null and open_time < close_time))
);

create trigger business_hours_updated_at before update on public.business_hours
  for each row execute function public.set_updated_at();

-- Horários de início liberados para agendamento online, por dia da semana.
-- São configurados pela profissional (nenhum intervalo é gerado automaticamente).
create table public.available_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null check (extract(second from start_time) = 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (weekday, start_time)
);

-- ---------------------------------------------------------------------
-- Bloqueios de agenda
-- ---------------------------------------------------------------------

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index schedule_blocks_range on public.schedule_blocks (starts_at, ends_at);

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------

create type public.appointment_status as enum (
  'pending',    -- reserva feita pela cliente, aguardando confirmação
  'confirmed',  -- confirmada pela profissional
  'completed',  -- atendimento concluído
  'cancelled',  -- cancelado: libera o horário
  'no_show'     -- cliente não compareceu
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  -- Fotografia do serviço no momento do agendamento (não muda se o preço mudar).
  service_name text not null,
  service_price_cents integer not null check (service_price_cents >= 0),
  service_duration_minutes integer,
  -- Fotografia dos dados informados no momento do agendamento.
  client_name text not null,
  client_phone text not null,
  starts_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  source text not null default 'online' check (source in ('online', 'admin')),
  client_notes text check (client_notes is null or char_length(client_notes) <= 500),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 1000),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(second from starts_at) = 0)
);

-- PROTEÇÃO CONTRA AGENDAMENTO DUPLICADO:
-- só pode existir um agendamento não cancelado por horário de início.
-- Duas reservas simultâneas: a segunda falha com unique_violation.
create unique index appointments_one_active_per_slot
  on public.appointments (starts_at)
  where status <> 'cancelled';

create index appointments_starts_at on public.appointments (starts_at);
create index appointments_client on public.appointments (client_id, starts_at desc);
create index appointments_status on public.appointments (status, starts_at);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Histórico de alterações
-- ---------------------------------------------------------------------

create table public.appointment_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  action text not null check (action in ('created', 'status_changed', 'rescheduled', 'updated')),
  old_status public.appointment_status,
  new_status public.appointment_status,
  old_starts_at timestamptz,
  new_starts_at timestamptz,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index appointment_history_appointment on public.appointment_history (appointment_id, created_at);

create or replace function public.log_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_history (appointment_id, action, new_status, new_starts_at, note, changed_by)
    values (new.id, 'created', new.status, new.starts_at,
            case when new.source = 'online' then 'Reserva online' else 'Criado no painel' end,
            auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.appointment_history (appointment_id, action, old_status, new_status, note, changed_by)
    values (new.id, 'status_changed', old.status, new.status,
            case when new.status = 'cancelled' then new.cancellation_reason end,
            auth.uid());
  end if;

  if new.starts_at is distinct from old.starts_at then
    insert into public.appointment_history (appointment_id, action, old_starts_at, new_starts_at, changed_by)
    values (new.id, 'rescheduled', old.starts_at, new.starts_at, auth.uid());
  end if;

  if (new.client_notes, new.internal_notes, new.service_id, new.service_price_cents)
     is distinct from (old.client_notes, old.internal_notes, old.service_id, old.service_price_cents) then
    insert into public.appointment_history (appointment_id, action, changed_by)
    values (new.id, 'updated', auth.uid());
  end if;

  return new;
end;
$$;

create trigger appointments_history
  after insert or update on public.appointments
  for each row execute function public.log_appointment_change();

-- Registro genérico das alterações de configuração e cadastros.
create table public.change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index change_log_table_record on public.change_log (table_name, record_id, created_at desc);

create or replace function public.log_generic_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.change_log (table_name, record_id, action, old_data, new_data, changed_by)
  values (tg_table_name, coalesce(v_new, v_old) ->> coalesce(tg_argv[0], 'id'), tg_op, v_old, v_new, auth.uid());
  return coalesce(new, old);
end;
$$;

create trigger services_log after insert or update or delete on public.services
  for each row execute function public.log_generic_change();
create trigger clients_log after update or delete on public.clients
  for each row execute function public.log_generic_change();
create trigger business_hours_log after insert or update or delete on public.business_hours
  for each row execute function public.log_generic_change('weekday');
create trigger available_slots_log after insert or update or delete on public.available_slots
  for each row execute function public.log_generic_change();
create trigger schedule_blocks_log after insert or update or delete on public.schedule_blocks
  for each row execute function public.log_generic_change();
create trigger professionals_log after update on public.professionals
  for each row execute function public.log_generic_change();

-- =====================================================================
-- Disponibilidade (consultada no servidor)
-- =====================================================================

-- Horários livres de um dia (data local de São Paulo).
-- Considera: dia aberto, horário configurado e dentro do expediente,
-- antecedência mínima, janela máxima, bloqueios e reservas existentes.
create or replace function public.get_available_slots(p_date date)
returns table (starts_at timestamptz, label text)
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (
    select
      coalesce((select min_advance_minutes from public.professionals where is_primary), 60) as min_adv,
      coalesce((select booking_window_days from public.professionals where is_primary), 60) as window_days,
      (now() at time zone public.studio_timezone())::date as today
  ),
  candidates as (
    select
      ((p_date + s.start_time) at time zone public.studio_timezone()) as starts_at,
      to_char(s.start_time, 'HH24:MI') as label
    from public.available_slots s
    join public.business_hours bh
      on bh.weekday = s.weekday and bh.is_open
    cross join cfg
    where s.weekday = extract(dow from p_date)::int
      and s.is_active
      and s.start_time >= bh.open_time
      and s.start_time < bh.close_time
      and p_date >= cfg.today
      and p_date <= cfg.today + cfg.window_days
  )
  select c.starts_at, c.label
  from candidates c, cfg
  where c.starts_at > now() + make_interval(mins => cfg.min_adv)
    and not exists (
      select 1 from public.appointments a
      where a.starts_at = c.starts_at and a.status <> 'cancelled'
    )
    and not exists (
      select 1 from public.schedule_blocks b
      where c.starts_at >= b.starts_at and c.starts_at < b.ends_at
    )
  order by c.starts_at;
$$;

-- Dias (entre p_from e p_to) que possuem ao menos um horário livre.
create or replace function public.get_available_dates(p_from date, p_to date)
returns setof date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    if exists (select 1 from public.get_available_slots(d)) then
      return next d;
    end if;
  end loop;
end;
$$;

-- =====================================================================
-- Reserva pública (cliente sem conta)
-- =====================================================================
-- Erros retornados (mensagem da exception):
--   INVALID_NAME, INVALID_PHONE, INVALID_NOTES, SERVICE_UNAVAILABLE,
--   SLOT_TAKEN, SLOT_UNAVAILABLE, TOO_MANY_BOOKINGS
create or replace function public.create_public_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_notes text default null
)
returns table (
  appointment_id uuid,
  service_name text,
  service_price_cents integer,
  starts_at timestamptz,
  status public.appointment_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := public.normalize_phone(p_phone);
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_service public.services%rowtype;
  v_client_id uuid;
  v_local_date date;
  v_max_active integer;
  v_id uuid;
begin
  if char_length(v_name) < 3 or char_length(v_name) > 120 or v_name !~ '[[:alpha:]]' then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTES' using errcode = 'P0001';
  end if;

  select * into v_service from public.services s where s.id = p_service_id and s.is_active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_starts_at is null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Serializa reservas concorrentes para o mesmo horário.
  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || p_starts_at::text, 0));

  -- Revalidação no momento da confirmação.
  if exists (
    select 1 from public.appointments a
    where a.starts_at = p_starts_at and a.status <> 'cancelled'
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone public.studio_timezone())::date;
  if not exists (
    select 1 from public.get_available_slots(v_local_date) s where s.starts_at = p_starts_at
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Cliente: identificada pelo telefone. Um cadastro existente não tem o
  -- nome sobrescrito por reservas públicas (o nome digitado fica no agendamento).
  insert into public.clients (full_name, phone)
  values (v_name, v_phone)
  on conflict (phone) do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select c.id into v_client_id from public.clients c where c.phone = v_phone;
  end if;

  select coalesce(max_active_bookings_per_phone, 3) into v_max_active
  from public.professionals where is_primary;

  if (
    select count(*) from public.appointments a
    where a.client_id = v_client_id
      and a.status in ('pending', 'confirmed')
      and a.starts_at > now()
  ) >= coalesce(v_max_active, 3) then
    raise exception 'TOO_MANY_BOOKINGS' using errcode = 'P0001';
  end if;

  begin
    insert into public.appointments (
      client_id, service_id, service_name, service_price_cents, service_duration_minutes,
      client_name, client_phone, starts_at, status, source, client_notes
    ) values (
      v_client_id, v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes,
      v_name, v_phone, p_starts_at, 'pending', 'online', v_notes
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query
    select a.id, a.service_name, a.service_price_cents, a.starts_at, a.status
    from public.appointments a where a.id = v_id;
end;
$$;

-- =====================================================================
-- Operações administrativas (exigem is_admin)
-- =====================================================================

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.slot_is_blocked(p_starts_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedule_blocks b
    where p_starts_at >= b.starts_at and p_starts_at < b.ends_at
  );
$$;

-- Cria agendamento pelo painel. A profissional pode marcar fora dos horários
-- configurados, mas nunca em horário ocupado ou bloqueado.
create or replace function public.admin_create_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_notes text default null,
  p_status public.appointment_status default 'confirmed',
  p_price_cents integer default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := public.normalize_phone(p_phone);
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_service public.services%rowtype;
  v_client_id uuid;
  v_id uuid;
begin
  perform public.assert_admin();

  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if p_status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_price_cents is not null and (p_price_cents < 0 or p_price_cents > 10000000) then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  select * into v_service from public.services s where s.id = p_service_id;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_starts_at is null or extract(second from p_starts_at) <> 0 then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || p_starts_at::text, 0));

  if exists (select 1 from public.appointments a where a.starts_at = p_starts_at and a.status <> 'cancelled') then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  if public.slot_is_blocked(p_starts_at) then
    raise exception 'SLOT_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.clients (full_name, phone)
  values (v_name, v_phone)
  on conflict (phone) do update set full_name = excluded.full_name
  returning id into v_client_id;

  begin
    insert into public.appointments (
      client_id, service_id, service_name, service_price_cents, service_duration_minutes,
      client_name, client_phone, starts_at, status, source, client_notes, confirmed_at
    ) values (
      v_client_id, v_service.id, v_service.name, coalesce(p_price_cents, v_service.price_cents),
      v_service.duration_minutes, v_name, v_phone, p_starts_at, p_status, 'admin', v_notes,
      case when p_status = 'confirmed' then now() end
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

-- Altera o status respeitando transições válidas.
--   pending   -> confirmed | cancelled
--   confirmed -> completed | cancelled | no_show | pending
--   no_show   -> completed | confirmed
--   completed, cancelled -> (final)
create or replace function public.admin_set_appointment_status(
  p_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current public.appointment_status;
begin
  perform public.assert_admin();

  select a.status into v_current from public.appointments a where a.id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if not (
    (v_current = 'pending' and p_status in ('confirmed', 'cancelled')) or
    (v_current = 'confirmed' and p_status in ('completed', 'cancelled', 'no_show', 'pending')) or
    (v_current = 'no_show' and p_status in ('completed', 'confirmed'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  update public.appointments a set
    status = p_status,
    confirmed_at = case when p_status = 'confirmed' then now() else a.confirmed_at end,
    completed_at = case when p_status = 'completed' then now() else a.completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else a.cancelled_at end,
    cancellation_reason = case when p_status = 'cancelled'
      then nullif(trim(coalesce(p_reason, '')), '') else a.cancellation_reason end
  where a.id = p_id;
end;
$$;

-- Remarca para outro horário livre e não bloqueado.
create or replace function public.admin_reschedule_appointment(
  p_id uuid,
  p_starts_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current public.appointments%rowtype;
begin
  perform public.assert_admin();

  if p_starts_at is null or extract(second from p_starts_at) <> 0 then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_current from public.appointments a where a.id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_current.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if v_current.starts_at = p_starts_at then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || p_starts_at::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.starts_at = p_starts_at and a.status <> 'cancelled' and a.id <> p_id
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  if public.slot_is_blocked(p_starts_at) then
    raise exception 'SLOT_BLOCKED' using errcode = 'P0001';
  end if;

  begin
    update public.appointments set starts_at = p_starts_at where id = p_id;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;
end;
$$;

-- =====================================================================
-- Segurança: RLS e permissões
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.business_hours enable row level security;
alter table public.available_slots enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.change_log enable row level security;

-- Visitantes não acessam tabelas com dados pessoais nem de auditoria.
revoke all on public.profiles, public.clients, public.appointments,
  public.appointment_history, public.change_log, public.schedule_blocks,
  public.available_slots
  from anon;
revoke insert, update, delete on public.services, public.business_hours, public.professionals from anon;

-- profiles
create policy "Usuária lê o próprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Admin atualiza perfis" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- professionals (nome e marca são públicos)
create policy "Público lê dados da profissional" on public.professionals
  for select to anon, authenticated using (true);
create policy "Admin atualiza profissional" on public.professionals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- services
create policy "Público lê serviços ativos" on public.services
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "Admin cria serviços" on public.services
  for insert to authenticated with check (public.is_admin());
create policy "Admin edita serviços" on public.services
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin remove serviços" on public.services
  for delete to authenticated using (public.is_admin());

-- business_hours (expediente é informação pública)
create policy "Público lê expediente" on public.business_hours
  for select to anon, authenticated using (true);
create policy "Admin edita expediente" on public.business_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tabelas exclusivas do painel
create policy "Admin gerencia horários" on public.available_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin gerencia bloqueios" on public.schedule_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin gerencia clientes" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin lê agendamentos" on public.appointments
  for select to authenticated using (public.is_admin());
-- Alterações de status/horário passam pelas funções admin_* (validadas).
-- Edição direta fica restrita a observações internas.
create policy "Admin edita observações" on public.appointments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin lê histórico" on public.appointment_history
  for select to authenticated using (public.is_admin());
create policy "Admin lê registro de alterações" on public.change_log
  for select to authenticated using (public.is_admin());

revoke insert, delete on public.appointments from authenticated;
revoke update on public.appointments from authenticated;
grant update (internal_notes) on public.appointments to authenticated;
revoke insert, update, delete on public.appointment_history, public.change_log from authenticated;

-- Funções: execução explícita
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.studio_timezone() to anon, authenticated;
grant execute on function public.normalize_phone(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_available_slots(date) to anon, authenticated;
grant execute on function public.get_available_dates(date, date) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, timestamptz, text, text, text) to anon, authenticated;

grant execute on function public.admin_create_appointment(uuid, timestamptz, text, text, text, public.appointment_status, integer) to authenticated;
grant execute on function public.admin_set_appointment_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.admin_reschedule_appointment(uuid, timestamptz) to authenticated;

-- Funções de gatilho/auxiliares não são chamáveis diretamente via API
-- (assert_admin, slot_is_blocked, set_updated_at, log_*).

-- Funções novas também não ficam abertas por padrão.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
