-- Primeiro acesso ao painel: cria a conta da profissional pela tela de login.
-- Só funciona enquanto não existir nenhuma administradora e exige um código
-- de uso único. O código é gravado (como hash) direto no banco, fora do repositório:
--   insert into private.setup_codes (code_hash) values (extensions.crypt('<código>', extensions.gen_salt('bf')));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.setup_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.first_admin_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where role = 'admin')
     and exists (select 1 from private.setup_codes where used_at is null);
$$;

create or replace function public.create_first_admin(
  p_full_name text,
  p_email text,
  p_password text,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_code_id uuid;
  v_user_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtext('create_first_admin'));

  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'ADMIN_EXISTS' using errcode = 'P0001';
  end if;

  select id into v_code_id
  from private.setup_codes
  where used_at is null
    and code_hash = extensions.crypt(upper(trim(p_code)), code_hash)
  limit 1;
  if v_code_id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  if coalesce(length(trim(p_full_name)), 0) < 2 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if coalesce(length(p_password), 0) < 8 then
    raise exception 'INVALID_PASSWORD' using errcode = 'P0001';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'EMAIL_TAKEN' using errcode = 'P0001';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(p_full_name)), now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, full_name, role) values (v_user_id, trim(p_full_name), 'admin');
  update public.professionals set user_id = v_user_id where is_primary and user_id is null;
  update private.setup_codes set used_at = now() where id = v_code_id;
end;
$$;

revoke execute on function public.first_admin_available() from public;
revoke execute on function public.create_first_admin(text, text, text, text) from public;
grant execute on function public.first_admin_available() to anon, authenticated;
grant execute on function public.create_first_admin(text, text, text, text) to anon;
