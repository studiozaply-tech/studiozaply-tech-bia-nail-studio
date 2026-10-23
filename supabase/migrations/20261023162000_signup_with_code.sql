-- Novo cadastro pela tela de login, sempre com um código de convite de uso único.
-- Quem já tem acesso ao painel gera o código em Configurações; o código vale 7 dias.

alter table private.setup_codes
  add column if not exists expires_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists used_by uuid;

create or replace function public.create_account(
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
  v_code text := private.normalize_setup_code(p_code);
  v_code_id uuid;
  v_user_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtext('create_account'));

  select id into v_code_id
  from private.setup_codes
  where used_at is null
    and (expires_at is null or expires_at > now())
    and v_code <> ''
    and code_hash = extensions.crypt(v_code, code_hash)
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
  update private.setup_codes set used_at = now(), used_by = v_user_id where id = v_code_id;
end;
$$;

create or replace function public.admin_create_signup_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := extensions.gen_random_bytes(8);
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
  end loop;
  insert into private.setup_codes (code_hash, expires_at, created_by)
  values (extensions.crypt(v_code, extensions.gen_salt('bf')), now() + interval '7 days', auth.uid());
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
end;
$$;


revoke execute on function public.create_account(text, text, text, text) from public;
revoke execute on function public.admin_create_signup_code() from public;
grant execute on function public.create_account(text, text, text, text) to anon;
grant execute on function public.admin_create_signup_code() to authenticated;
