-- ============================================================
-- LumiTEA — CHAT_SCHEMA.sql
-- Chat em tempo real (salas), separado por público
-- (adolescentes x cuidadores). Estilo WhatsApp/Telegram.
-- Reusa a função public.meu_publico() de COMUNIDADE_SCHEMA.sql.
-- Idempotente: pode rodar de novo. Rode no SQL Editor do Supabase.
-- ============================================================

create extension if not exists pgcrypto;

-- Garante a função de público (caso CHAT rode antes de COMUNIDADE).
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

-- ─────────────────────────── MENSAGENS ───────────────────────
create table if not exists comunidade_chat (
  id         uuid primary key default gen_random_uuid(),
  sala       text not null,                                   -- ex.: 'geral', 'desabafos'
  publico    text not null check (publico in ('teen','cuidador')),
  autor_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  autor_nome text not null default 'Alguém',
  texto      text not null check (char_length(texto) between 1 and 1000),
  criado_em  timestamptz not null default now()
);
create index if not exists idx_chat_sala on comunidade_chat (publico, sala, criado_em);

alter table comunidade_chat enable row level security;

-- Só vê/escreve mensagens do próprio público (teen x cuidador).
drop policy if exists chat_select on comunidade_chat;
create policy chat_select on comunidade_chat
  for select to authenticated
  using (publico = public.meu_publico());

drop policy if exists chat_insert on comunidade_chat;
create policy chat_insert on comunidade_chat
  for insert to authenticated
  with check (autor_id = auth.uid() and publico = public.meu_publico());

-- Cada um apaga só a própria mensagem.
drop policy if exists chat_delete on comunidade_chat;
create policy chat_delete on comunidade_chat
  for delete to authenticated
  using (autor_id = auth.uid());

-- ──────────────────── REALTIME (tempo real) ──────────────────
-- Publica a tabela no canal de Realtime do Supabase para que o
-- cliente receba novas mensagens na hora (respeitando o RLS acima).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'comunidade_chat'
  ) then
    alter publication supabase_realtime add table comunidade_chat;
  end if;
end $$;

-- ============================================================
-- Pronto. Salas são definidas no cliente (js/chat.js); o RLS
-- garante o isolamento entre adolescentes e cuidadores.
-- ============================================================
