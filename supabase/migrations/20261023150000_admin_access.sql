-- =====================================================================
-- Acesso ao painel pela tela de login
--
--   * Primeiro acesso: enquanto não existir nenhuma admin, quem criar a
--     conta pela tela /admin/login vira admin (e é ligada à profissional).
--   * Depois disso, só e-mails liberados por uma admin em
--     Configurações > Acessos ao painel conseguem virar admin.
--   * Contas criadas sem convite não acessam nada (RLS exige is_admin).
-- =====================================================================

create table public.admin_invites (
  email text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.admin_invites is
  'E-mails liberados para criar acesso de admin pela tela de login.';

alter table public.admin_invites enable row level security;

create policy "Admin gerencia convites" on public.admin_invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Visitantes só precisam saber se o painel já tem dona (para mostrar o texto certo).
create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

-- Dá acesso de admin à usuária logada quando: não há nenhuma admin ainda,
-- ou o e-mail dela foi liberado em admin_invites. Retorna true se ela é admin.
create or replace function public.claim_admin_access(p_full_name text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if v_uid is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if public.is_admin() then
    return true;
  end if;

  -- Serializa para que duas contas não virem a "primeira admin" ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtext('claim_admin_access'));

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  if exists (select 1 from public.profiles where role = 'admin')
     and not exists (select 1 from public.admin_invites i where i.email = v_email) then
    return false;
  end if;

  insert into public.profiles (id, full_name, role)
  values (v_uid, coalesce(left(v_name, 80), split_part(v_email, '@', 1), ''), 'admin')
  on conflict (id) do update
    set role = 'admin',
        full_name = coalesce(left(v_name, 80), nullif(public.profiles.full_name, ''), excluded.full_name);

  delete from public.admin_invites where email = v_email;

  update public.professionals set user_id = v_uid where user_id is null;

  return true;
end;
$$;

grant execute on function public.admin_exists() to anon, authenticated;
grant execute on function public.claim_admin_access(text) to authenticated;
