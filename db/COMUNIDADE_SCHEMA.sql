-- ============================================================
-- LumiTEA — COMUNIDADE_SCHEMA.sql
-- Comunidades separadas por público (adolescentes x cuidadores)
-- + reações de apoio + comentários. Idempotente: pode rodar de novo.
--
-- Rode no SQL Editor do Supabase (uma vez).
-- ============================================================

-- pgcrypto p/ gen_random_uuid (já vem no Supabase, mas garante)
create extension if not exists pgcrypto;

-- Função: qual "público" o usuário logado enxerga.
-- responsavel/terapeuta -> 'cuidador'; neurodivergente -> 'teen'.
create or replace function public.meu_publico()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.tipo in ('responsavel','terapeuta')
    ) then 'cuidador'
    else 'teen'
  end;
$$;

-- ─────────────────────────── POSTS ───────────────────────────
create table if not exists comunidade_posts (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  autor_nome text not null default 'Alguém',
  publico    text not null check (publico in ('teen','cuidador')),
  categoria  text,
  texto      text not null check (char_length(texto) between 1 and 2000),
  criado_em  timestamptz not null default now()
);
create index if not exists idx_com_posts_publico on comunidade_posts (publico, criado_em desc);

alter table comunidade_posts enable row level security;

drop policy if exists com_posts_select on comunidade_posts;
create policy com_posts_select on comunidade_posts
  for select to authenticated
  using (publico = public.meu_publico());

drop policy if exists com_posts_insert on comunidade_posts;
create policy com_posts_insert on comunidade_posts
  for insert to authenticated
  with check (autor_id = auth.uid() and publico = public.meu_publico());

drop policy if exists com_posts_delete on comunidade_posts;
create policy com_posts_delete on comunidade_posts
  for delete to authenticated
  using (autor_id = auth.uid());

-- ───────────────────────── COMENTÁRIOS ───────────────────────
create table if not exists comunidade_comentarios (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references comunidade_posts(id) on delete cascade,
  autor_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  autor_nome text not null default 'Alguém',
  texto      text not null check (char_length(texto) between 1 and 1000),
  criado_em  timestamptz not null default now()
);
create index if not exists idx_com_coment_post on comunidade_comentarios (post_id, criado_em);

alter table comunidade_comentarios enable row level security;

drop policy if exists com_coment_select on comunidade_comentarios;
create policy com_coment_select on comunidade_comentarios
  for select to authenticated
  using (exists (
    select 1 from comunidade_posts po
    where po.id = post_id and po.publico = public.meu_publico()
  ));

drop policy if exists com_coment_insert on comunidade_comentarios;
create policy com_coment_insert on comunidade_comentarios
  for insert to authenticated
  with check (autor_id = auth.uid() and exists (
    select 1 from comunidade_posts po
    where po.id = post_id and po.publico = public.meu_publico()
  ));

drop policy if exists com_coment_delete on comunidade_comentarios;
create policy com_coment_delete on comunidade_comentarios
  for delete to authenticated
  using (autor_id = auth.uid());

-- ──────────────────── APOIOS (curtidas de apoio) ─────────────
create table if not exists comunidade_apoios (
  post_id   uuid not null references comunidade_posts(id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table comunidade_apoios enable row level security;

drop policy if exists com_apoios_select on comunidade_apoios;
create policy com_apoios_select on comunidade_apoios
  for select to authenticated
  using (exists (
    select 1 from comunidade_posts po
    where po.id = post_id and po.publico = public.meu_publico()
  ));

drop policy if exists com_apoios_insert on comunidade_apoios;
create policy com_apoios_insert on comunidade_apoios
  for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from comunidade_posts po
    where po.id = post_id and po.publico = public.meu_publico()
  ));

drop policy if exists com_apoios_delete on comunidade_apoios;
create policy com_apoios_delete on comunidade_apoios
  for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Pronto. As políticas garantem que adolescentes só veem/escrevem
-- na comunidade 'teen' e cuidadores na 'cuidador'.
-- ============================================================
