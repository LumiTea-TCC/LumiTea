-- ============================================================
-- LumiTEA — LOGIN_TELEFONE.sql
-- Login por número de celular (identidade), SEM custo de SMS.
-- O celular vira o identificador de entrada; a VERIFICAÇÃO continua
-- por e-mail (confirmação nativa do Supabase).
--
-- Como funciona:
--   • cadastro guarda o celular (só dígitos) em profiles.telefone
--     e nos metadados do usuário (raw_user_meta_data->>'telefone').
--   • no login, o cliente troca o celular pelo e-mail via a função
--     public.email_por_telefone() e então usa signInWithPassword.
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Coluna de telefone em profiles ----------------------------
alter table public.profiles add column if not exists telefone text;

-- Índice para o lookup por telefone (não-único de propósito: evita
-- que uma colisão quebre a trigger de signup; a duplicidade é
-- checada no cliente antes de cadastrar).
create index if not exists idx_profiles_telefone on public.profiles (telefone);

-- 2) Trigger de criação de perfil agora grava o telefone --------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, sobrenome, tipo, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'sobrenome', ''),
    coalesce(new.raw_user_meta_data->>'tipo', 'neurodivergente'),
    nullif(coalesce(new.raw_user_meta_data->>'telefone', ''), '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise log 'handle_new_user falhou para % : %', new.id, sqlerrm;
  return new;
end;
$$;

-- 3) Lookup: telefone -> e-mail (para login por celular) --------
-- SECURITY DEFINER para poder ler auth.users; exposto a anon para
-- funcionar ANTES do login. Recebe o telefone só com dígitos.
create or replace function public.email_por_telefone(tel text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.telefone = regexp_replace(coalesce(tel, ''), '\D', '', 'g')
    and p.telefone is not null
  limit 1;
$$;

grant execute on function public.email_por_telefone(text) to anon, authenticated;

-- 4) (Opcional) Checagem de telefone já cadastrado, usada no
--    cadastro para avisar antes de criar a conta.
create or replace function public.telefone_existe(tel text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where telefone = regexp_replace(coalesce(tel, ''), '\D', '', 'g')
      and telefone is not null
  );
$$;

grant execute on function public.telefone_existe(text) to anon, authenticated;

-- ============================================================
-- Pronto. Usuários antigos (sem telefone) continuam entrando
-- pelo e-mail normalmente — o login aceita celular OU e-mail.
-- ============================================================
