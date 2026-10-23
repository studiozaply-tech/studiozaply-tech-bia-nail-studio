-- =====================================================================
-- Várias contas: cada conta é dona de um estúdio (public.professionals)
-- e só enxerga os próprios serviços, clientes, horários, bloqueios e
-- agendamentos. A separação é garantida pelo banco (RLS e funções),
-- não pela interface.
--
-- Os dados que já existiam ficam no estúdio principal (is_primary),
-- que continua sendo o site da página inicial.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Estúdios: link público (slug) e dona
-- ---------------------------------------------------------------------

alter table public.professionals add column if not exists slug text;
update public.professionals set slug = 'beatriz-abreu' where is_primary and slug is null;
update public.professionals set slug = 'estudio-' || left(replace(id::text, '-', ''), 8) where slug is null;
alter table public.professionals
  alter column slug set not null,
  alter column is_primary set default false,
  add constraint professionals_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60);
create unique index professionals_slug_unique on public.professionals (slug);
create unique index professionals_one_per_user on public.professionals (user_id) where user_id is not null;

-- Estúdio da usuária logada (null quando não tem).
create or replace function public.current_professional_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.professionals p where p.user_id = auth.uid();
$$;

-- Acesso ao painel = ser dona de um estúdio.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_professional_id() is not null;
$$;

-- Usado pelas funções do painel: devolve o estúdio da usuária ou recusa.
create or replace function public.require_professional()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.current_professional_id();
begin
  if v_id is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_professional();
end;
$$;

-- ---------------------------------------------------------------------
-- Coluna professional_id em todas as tabelas do estúdio
-- ---------------------------------------------------------------------

do $$
declare
  t text;
  v_primary uuid := (select id from public.professionals where is_primary);
begin
  foreach t in array array['services', 'clients', 'business_hours', 'available_slots', 'schedule_blocks', 'appointments'] loop
    execute format('alter table public.%I add column if not exists professional_id uuid references public.professionals (id) on delete cascade', t);
    execute format('update public.%I set professional_id = $1 where professional_id is null', t) using v_primary;
    execute format('alter table public.%I alter column professional_id set not null', t);
    execute format('alter table public.%I alter column professional_id set default public.current_professional_id()', t);
    execute format('create index if not exists %I on public.%I (professional_id)', t || '_professional', t);
  end loop;
end $$;

alter table public.change_log add column if not exists professional_id uuid;
update public.change_log set professional_id = (select id from public.professionals where is_primary) where professional_id is null;
create index if not exists change_log_professional on public.change_log (professional_id, created_at desc);

-- Unicidades passam a valer dentro de cada estúdio.
drop index if exists public.services_name_unique;
create unique index services_name_unique on public.services (professional_id, lower(trim(name)));

alter table public.clients drop constraint if exists clients_phone_key;
alter table public.clients add constraint clients_phone_per_professional unique (professional_id, phone);
alter table public.clients add constraint clients_id_professional unique (id, professional_id);

alter table public.business_hours drop constraint if exists business_hours_pkey;
alter table public.business_hours add primary key (professional_id, weekday);

alter table public.available_slots drop constraint if exists available_slots_weekday_start_time_key;
alter table public.available_slots add constraint available_slots_unique unique (professional_id, weekday, start_time);

drop index if exists public.appointments_one_active_per_slot;
create unique index appointments_one_active_per_slot
  on public.appointments (professional_id, starts_at)
  where status <> 'cancelled';

-- Agendamento e cliente sempre do mesmo estúdio.
alter table public.appointments drop constraint if exists appointments_client_id_fkey;
alter table public.appointments add constraint appointments_client_same_professional
  foreign key (client_id, professional_id) references public.clients (id, professional_id) on delete restrict;

-- Ninguém muda um registro de estúdio depois de criado.
create or replace function public.keep_professional_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.professional_id is distinct from old.professional_id then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['services', 'clients', 'business_hours', 'available_slots', 'schedule_blocks', 'appointments'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_keep_professional', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.keep_professional_id()', t || '_keep_professional', t);
  end loop;
end $$;

-- Registro de alterações guarda de qual estúdio é cada linha.
create or replace function public.log_generic_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into public.change_log (table_name, record_id, action, old_data, new_data, changed_by, professional_id)
  values (
    tg_table_name, v_row ->> coalesce(tg_argv[0], 'id'), tg_op, v_old, v_new, auth.uid(),
    coalesce((v_row ->> 'professional_id')::uuid, case when tg_table_name = 'professionals' then (v_row ->> 'id')::uuid end)
  );
  return coalesce(new, old);
end;
$$;

-- =====================================================================
-- Disponibilidade e reserva pública, por estúdio
-- =====================================================================

create or replace function public.get_available_slots(p_professional_id uuid, p_date date)
returns table (starts_at timestamptz, label text)
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (
    select p.min_advance_minutes as min_adv,
           p.booking_window_days as window_days,
           (now() at time zone public.studio_timezone())::date as today
    from public.professionals p
    where p.id = p_professional_id
  ),
  candidates as (
    select
      ((p_date + s.start_time) at time zone public.studio_timezone()) as starts_at,
      to_char(s.start_time, 'HH24:MI') as label
    from public.available_slots s
    join public.business_hours bh
      on bh.professional_id = s.professional_id and bh.weekday = s.weekday and bh.is_open
    cross join cfg
    where s.professional_id = p_professional_id
      and s.weekday = extract(dow from p_date)::int
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
      where a.professional_id = p_professional_id and a.starts_at = c.starts_at and a.status <> 'cancelled'
    )
    and not exists (
      select 1 from public.schedule_blocks b
      where b.professional_id = p_professional_id and c.starts_at >= b.starts_at and c.starts_at < b.ends_at
    )
  order by c.starts_at;
$$;

create or replace function public.get_available_dates(p_professional_id uuid, p_from date, p_to date)
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
    if exists (select 1 from public.get_available_slots(p_professional_id, d)) then
      return next d;
    end if;
  end loop;
end;
$$;

create or replace function public.slot_is_blocked(p_professional_id uuid, p_starts_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedule_blocks b
    where b.professional_id = p_professional_id and p_starts_at >= b.starts_at and p_starts_at < b.ends_at
  );
$$;

create or replace function public.create_public_booking(
  p_professional_id uuid,
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

  select * into v_service from public.services s
  where s.id = p_service_id and s.professional_id = p_professional_id and s.is_active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_starts_at is null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || p_professional_id::text || ':' || p_starts_at::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.professional_id = p_professional_id and a.starts_at = p_starts_at and a.status <> 'cancelled'
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone public.studio_timezone())::date;
  if not exists (
    select 1 from public.get_available_slots(p_professional_id, v_local_date) s where s.starts_at = p_starts_at
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.clients (professional_id, full_name, phone)
  values (p_professional_id, v_name, v_phone)
  on conflict (professional_id, phone) do nothing
  returning id into v_client_id;

  if v_client_id is null then
    select c.id into v_client_id from public.clients c
    where c.professional_id = p_professional_id and c.phone = v_phone;
  end if;

  select coalesce(max_active_bookings_per_phone, 3) into v_max_active
  from public.professionals where id = p_professional_id;

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
      professional_id, client_id, service_id, service_name, service_price_cents, service_duration_minutes,
      client_name, client_phone, starts_at, status, source, client_notes
    ) values (
      p_professional_id, v_client_id, v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes,
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

-- Versões antigas (sem estúdio) continuam funcionando para o estúdio principal
-- enquanto o site novo é publicado.
create or replace function public.get_available_slots(p_date date)
returns table (starts_at timestamptz, label text)
language sql stable security definer set search_path = ''
as $$
  select * from public.get_available_slots((select id from public.professionals where is_primary), p_date);
$$;

create or replace function public.get_available_dates(p_from date, p_to date)
returns setof date
language sql stable security definer set search_path = ''
as $$
  select * from public.get_available_dates((select id from public.professionals where is_primary), p_from, p_to);
$$;

create or replace function public.create_public_booking(
  p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text, p_notes text default null
)
returns table (appointment_id uuid, service_name text, service_price_cents integer, starts_at timestamptz, status public.appointment_status)
language sql volatile security definer set search_path = ''
as $$
  select * from public.create_public_booking(
    (select id from public.professionals where is_primary), p_service_id, p_starts_at, p_full_name, p_phone, p_notes);
$$;

-- =====================================================================
-- Funções do painel: sempre limitadas ao estúdio da usuária
-- =====================================================================

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
  v_pro uuid := public.require_professional();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone text := public.normalize_phone(p_phone);
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_service public.services%rowtype;
  v_client_id uuid;
  v_id uuid;
begin
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

  select * into v_service from public.services s where s.id = p_service_id and s.professional_id = v_pro;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if p_starts_at is null or extract(second from p_starts_at) <> 0 then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || v_pro::text || ':' || p_starts_at::text, 0));

  if exists (select 1 from public.appointments a
             where a.professional_id = v_pro and a.starts_at = p_starts_at and a.status <> 'cancelled') then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  if public.slot_is_blocked(v_pro, p_starts_at) then
    raise exception 'SLOT_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.clients (professional_id, full_name, phone)
  values (v_pro, v_name, v_phone)
  on conflict (professional_id, phone) do update set full_name = excluded.full_name
  returning id into v_client_id;

  begin
    insert into public.appointments (
      professional_id, client_id, service_id, service_name, service_price_cents, service_duration_minutes,
      client_name, client_phone, starts_at, status, source, client_notes, confirmed_at
    ) values (
      v_pro, v_client_id, v_service.id, v_service.name, coalesce(p_price_cents, v_service.price_cents),
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
  v_pro uuid := public.require_professional();
  v_current public.appointment_status;
begin
  select a.status into v_current from public.appointments a
  where a.id = p_id and a.professional_id = v_pro
  for update;
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
  where a.id = p_id and a.professional_id = v_pro;
end;
$$;

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
  v_pro uuid := public.require_professional();
  v_current public.appointments%rowtype;
begin
  if p_starts_at is null or extract(second from p_starts_at) <> 0 then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_current from public.appointments a
  where a.id = p_id and a.professional_id = v_pro
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_current.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if v_current.starts_at = p_starts_at then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('appointment-slot:' || v_pro::text || ':' || p_starts_at::text, 0));

  if exists (
    select 1 from public.appointments a
    where a.professional_id = v_pro and a.starts_at = p_starts_at and a.status <> 'cancelled' and a.id <> p_id
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  if public.slot_is_blocked(v_pro, p_starts_at) then
    raise exception 'SLOT_BLOCKED' using errcode = 'P0001';
  end if;

  begin
    update public.appointments set starts_at = p_starts_at where id = p_id and professional_id = v_pro;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;
end;
$$;

-- =====================================================================
-- Cadastro de nova conta (nome, e-mail e senha)
-- =====================================================================
-- Cada conta nova ganha um estúdio vazio, só dela. Não há acesso a dados
-- de outras contas. Senha guardada com bcrypt custo 12.

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_text, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', '-', 'g'));
$$;

create table if not exists private.signup_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

create or replace function public.request_account(
  p_full_name text,
  p_email text,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  n integer := 1;
begin
  perform pg_advisory_xact_lock(hashtext('request_account'));

  -- Limite contra cadastros em massa: 10 contas por hora no site todo.
  if (select count(*) from private.signup_attempts where created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if coalesce(length(p_password), 0) < 8 or length(p_password) > 72
     or p_password !~ '[A-Za-z]' or p_password !~ '[0-9]' then
    raise exception 'INVALID_PASSWORD' using errcode = 'P0001';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'EMAIL_TAKEN' using errcode = 'P0001';
  end if;

  insert into private.signup_attempts default values;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 12)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, full_name, role) values (v_user_id, v_name, 'admin');

  v_base := left(private.slugify(v_name), 50);
  if char_length(v_base) < 3 then
    v_base := 'estudio';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.professionals where slug = v_slug) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;

  insert into public.professionals (id, display_name, brand_name, user_id, slug, is_primary)
  values (v_pro_id, upper(v_name), v_name, v_user_id, v_slug, false);

  insert into public.business_hours (professional_id, weekday, is_open, open_time, close_time)
  select v_pro_id, d, d between 1 and 6, case when d between 1 and 6 then time '09:00' end, case when d between 1 and 6 then time '18:00' end
  from generate_series(0, 6) d;
end;
$$;

-- =====================================================================
-- RLS: cada conta só enxerga o próprio estúdio
-- =====================================================================

drop policy if exists "Usuária lê o próprio perfil" on public.profiles;
drop policy if exists "Admin atualiza perfis" on public.profiles;
create policy "Usuária lê o próprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Público lê dados da profissional" on public.professionals;
drop policy if exists "Admin atualiza profissional" on public.professionals;
create policy "Público lê dados do estúdio" on public.professionals
  for select to anon, authenticated using (true);
create policy "Dona atualiza o estúdio" on public.professionals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Só colunas públicas ficam visíveis; só as regras do estúdio são editáveis.
revoke select, insert, update, delete on public.professionals from anon, authenticated;
grant select (id, slug, display_name, brand_name, welcome_message, min_advance_minutes,
              booking_window_days, max_active_bookings_per_phone, is_primary)
  on public.professionals to anon, authenticated;
grant update (display_name, brand_name, welcome_message, min_advance_minutes,
              booking_window_days, max_active_bookings_per_phone)
  on public.professionals to authenticated;

drop policy if exists "Público lê serviços ativos" on public.services;
drop policy if exists "Admin cria serviços" on public.services;
drop policy if exists "Admin edita serviços" on public.services;
drop policy if exists "Admin remove serviços" on public.services;
create policy "Público lê serviços ativos" on public.services
  for select to anon using (is_active);
create policy "Dona lê serviços" on public.services
  for select to authenticated using (is_active or professional_id = public.current_professional_id());
create policy "Dona cria serviços" on public.services
  for insert to authenticated with check (professional_id = public.current_professional_id());
create policy "Dona edita serviços" on public.services
  for update to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());
create policy "Dona remove serviços" on public.services
  for delete to authenticated using (professional_id = public.current_professional_id());

drop policy if exists "Público lê expediente" on public.business_hours;
drop policy if exists "Admin edita expediente" on public.business_hours;
create policy "Público lê expediente" on public.business_hours
  for select to anon, authenticated using (true);
create policy "Dona edita expediente" on public.business_hours
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

drop policy if exists "Admin gerencia horários" on public.available_slots;
create policy "Dona gerencia horários" on public.available_slots
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

drop policy if exists "Admin gerencia bloqueios" on public.schedule_blocks;
create policy "Dona gerencia bloqueios" on public.schedule_blocks
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

drop policy if exists "Admin gerencia clientes" on public.clients;
create policy "Dona gerencia clientes" on public.clients
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

drop policy if exists "Admin lê agendamentos" on public.appointments;
drop policy if exists "Admin edita observações" on public.appointments;
create policy "Dona lê agendamentos" on public.appointments
  for select to authenticated using (professional_id = public.current_professional_id());
create policy "Dona edita observações" on public.appointments
  for update to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

drop policy if exists "Admin lê histórico" on public.appointment_history;
create policy "Dona lê histórico" on public.appointment_history
  for select to authenticated using (
    exists (select 1 from public.appointments a
            where a.id = appointment_id and a.professional_id = public.current_professional_id())
  );

drop policy if exists "Admin lê registro de alterações" on public.change_log;
create policy "Dona lê registro de alterações" on public.change_log
  for select to authenticated using (professional_id = public.current_professional_id());

-- =====================================================================
-- Permissões das funções
-- =====================================================================

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.studio_timezone() to anon, authenticated;
grant execute on function public.normalize_phone(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_professional_id() to authenticated;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;
grant execute on function public.get_available_dates(uuid, date, date) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_available_slots(date) to anon, authenticated;
grant execute on function public.get_available_dates(date, date) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.request_account(text, text, text) to anon;

grant execute on function public.admin_create_appointment(uuid, timestamptz, text, text, text, public.appointment_status, integer) to authenticated;
grant execute on function public.admin_set_appointment_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.admin_reschedule_appointment(uuid, timestamptz) to authenticated;
