-- ============================================================
-- LumiTEA — PSICOLOGO_SCHEMA.sql
-- Conta de psicólogo: tipo de conta novo, painel de múltiplos
-- pacientes e anotações clínicas privadas.
-- Idempotente: pode rodar de novo. Rode no SQL Editor do Supabase
-- (ou pela Management API — ver CLAUDE.md).
--
-- POR QUE NÃO REUSA O VÍNCULO DO CUIDADOR
-- `neurodivergente.id_responsavel` é uma FK única por adolescente —
-- só um "responsável" por vez. Se o psicólogo entrasse por esse
-- mesmo caminho (como `terapeuta` faz hoje, sem uso real), vincular
-- um psicólogo desconectaria o cuidador da família. Por isso existe
-- `vinculos_psicologo`: uma tabela à parte, N-pra-N de verdade,
-- que convive com o vínculo da família sem tocar nele.
--
-- POR QUE AS POLÍTICAS SÃO NOVAS EM VEZ DE EDITAR AS DO CUIDADOR
-- Toda política `_resp`/`_resp_read` já existente (humores, alertas,
-- relatorios...) fica exatamente como está. O psicólogo ganha
-- políticas ADICIONAIS, só de leitura, condicionadas a
-- `sou_psicologo_do()`. Zero risco de regressão no painel do
-- cuidador — nenhuma linha dele é tocada aqui.
--
-- O QUE O PSICÓLOGO NÃO TEM NESTA PRIMEIRA VERSÃO
-- Comunidade, calendário e "ao vivo" continuam de fora — não foi
-- pedido, e cada um exigiria política nova pra revisar. Só leitura
-- de humor/alertas/relatórios do paciente + as próprias anotações
-- clínicas (essas sim, de escrita, e 100% privadas: nenhuma política
-- dá acesso a elas pro cuidador ou pro adolescente).
-- ============================================================

create extension if not exists pgcrypto;

-- ─────────────── 1. TIPO DE CONTA NOVO EM PROFILES ──────────
-- A constraint original é inline (sem nome próprio na CREATE TABLE), então
-- o Postgres a nomeou sozinho pelo padrão <tabela>_<coluna>_check —
-- confirmado em produção via Management API em 2026-09-02:
-- `profiles_tipo_check`, hoje só com ('neurodivergente','responsavel') —
-- nem 'terapeuta' está lá (nunca foi criável de verdade, ver CLAUDE.md).
-- DROP CONSTRAINT IF EXISTS + ADD é idempotente e não depende de casar a
-- sintaxe exata da definição (produção usa `= ANY (ARRAY[...])`, não
-- `IN (...)` — um `ilike '%in%'` teria falhado em achar essa constraint).
alter table public.profiles drop constraint if exists profiles_tipo_check;
alter table public.profiles
  add constraint profiles_tipo_check
  check (tipo in ('neurodivergente','responsavel','terapeuta','psicologo'));

-- ─────────────── 1b. CREDENCIAL: CRP + VERIFICAÇÃO MANUAL ────
-- "Provar que é psicólogo mesmo" nesta primeira versão = pedir o número do
-- CRP no cadastro (fica gravado, sem checagem automática contra o CFP/CRP —
-- não existe API pública confiável pra isso) + a conta nasce `verificado =
-- false` e fica IMPEDIDA de vincular pacientes (aceitar_vinculo_psicologo
-- abaixo recusa) até alguém aprovar manualmente. Não existe tela de admin —
-- aprovação é uma consulta direta no banco (ver o comentário de conferência
-- no fim do arquivo). Todo tipo que não é psicólogo já nasce verificado
-- (nunca passa por essa checagem).
alter table public.profiles add column if not exists crp text;
alter table public.profiles add column if not exists verificado boolean not null default true;

-- `handle_new_user()` já existia — replicado aqui por inteiro (não só um
-- ALTER) porque é `CREATE OR REPLACE`, então precisa do corpo completo pra
-- não perder nada do que já fazia. A versão em produção (conferida via
-- Management API em 2026-09-02, `select pg_get_functiondef(...)`) é
-- DIFERENTE da documentada em LUMITEA_SCHEMA.sql: já grava `telefone`
-- (LUMITEA_SCHEMA.sql não tem essa coluna no INSERT) e tem um bloco
-- `EXCEPTION WHEN OTHERS` que evita o erro 500 "Database error saving new
-- user" (ver db/FIX_SIGNUP_500.sql) — se essa versão perdesse esse bloco,
-- reintroduziria exatamente aquele bug. Só `crp`/`verificado` são novos aqui.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path to 'public' as $function$
begin
  insert into public.profiles (id, nome, sobrenome, tipo, telefone, crp, verificado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'sobrenome', ''),
    coalesce(new.raw_user_meta_data->>'tipo', 'neurodivergente'),
    nullif(coalesce(new.raw_user_meta_data->>'telefone', ''), ''),
    nullif(new.raw_user_meta_data->>'crp', ''),
    coalesce(new.raw_user_meta_data->>'tipo', 'neurodivergente') is distinct from 'psicologo'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise log 'handle_new_user falhou para % : %', new.id, sqlerrm;
  return new;
end;
$function$;

-- ─────────────── 2. VÍNCULOS PSICÓLOGO ↔ PACIENTE ────────────
create table if not exists vinculos_psicologo (
  id                 uuid primary key default gen_random_uuid(),
  id_psicologo       uuid not null references profiles(id) on delete cascade,
  id_neurodivergente uuid not null references profiles(id) on delete cascade,
  criado_em          timestamptz not null default now(),
  unique (id_psicologo, id_neurodivergente)
);
create index if not exists idx_vinc_psi_psicologo on vinculos_psicologo (id_psicologo);
create index if not exists idx_vinc_psi_teen       on vinculos_psicologo (id_neurodivergente);

alter table vinculos_psicologo enable row level security;

-- O psicólogo administra os próprios vínculos (ler, desfazer).
drop policy if exists vinculos_psicologo_self on vinculos_psicologo;
create policy vinculos_psicologo_self on vinculos_psicologo
  for all to authenticated
  using (id_psicologo = auth.uid())
  with check (id_psicologo = auth.uid());

-- O adolescente pode ver quem está vinculado a ele — transparência
-- básica, mesmo sem tela nenhuma lendo isso ainda (mesmo espírito de
-- `visivel_terapeuta` já existir em observacoes_cuidador sem uso).
drop policy if exists vinculos_psicologo_teen_read on vinculos_psicologo;
create policy vinculos_psicologo_teen_read on vinculos_psicologo
  for select to authenticated
  using (id_neurodivergente = auth.uid());

-- ─────────────── 3. HELPER: SOU PSICÓLOGO DESSE PACIENTE? ────
create or replace function public.sou_psicologo_do(p_teen uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vinculos_psicologo
     where id_psicologo = auth.uid() and id_neurodivergente = p_teen
  );
$$;

grant execute on function public.sou_psicologo_do(uuid) to authenticated;

-- ─────────────── 4. LEITURA ADICIONAL PRO PSICÓLOGO ──────────
-- Cinco políticas SELECT novas, uma por tabela. Nenhuma política já
-- existente é tocada — o cuidador continua exatamente como estava.
drop policy if exists profiles_psicologo_read on profiles;
create policy profiles_psicologo_read on profiles
  for select to authenticated
  using (public.sou_psicologo_do(id));

drop policy if exists nd_psicologo_read on neurodivergente;
create policy nd_psicologo_read on neurodivergente
  for select to authenticated
  using (public.sou_psicologo_do(id));

drop policy if exists humores_psicologo_read on humores;
create policy humores_psicologo_read on humores
  for select to authenticated
  using (public.sou_psicologo_do(id_neurodivergente));

drop policy if exists alertas_psicologo_read on alertas;
create policy alertas_psicologo_read on alertas
  for select to authenticated
  using (public.sou_psicologo_do(id_neurodivergente));

drop policy if exists rel_psicologo_read on relatorios;
create policy rel_psicologo_read on relatorios
  for select to authenticated
  using (public.sou_psicologo_do(id_neurodivergente));

-- ─────────────── 5. ANOTAÇÕES CLÍNICAS (100% PRIVADAS) ───────
-- Diferente de observacoes_cuidador (que tem uma policy condicional
-- pro terapeuta ler), aqui não existe NENHUMA policy que dê acesso
-- ao cuidador ou ao adolescente — pedido explícito do usuário.
create table if not exists notas_clinicas (
  id                 uuid primary key default gen_random_uuid(),
  id_neurodivergente uuid not null references profiles(id) on delete cascade,
  id_psicologo       uuid not null references profiles(id) on delete cascade,
  texto              text not null,
  criado_em          timestamptz not null default now()
);
create index if not exists idx_notas_clinicas_teen  on notas_clinicas (id_neurodivergente);
create index if not exists idx_notas_clinicas_psico on notas_clinicas (id_psicologo, criado_em desc);

alter table notas_clinicas enable row level security;

drop policy if exists notas_clinicas_psicologo on notas_clinicas;
create policy notas_clinicas_psicologo on notas_clinicas
  for all to authenticated
  using (id_psicologo = auth.uid() and public.sou_psicologo_do(id_neurodivergente))
  with check (id_psicologo = auth.uid() and public.sou_psicologo_do(id_neurodivergente));

-- ─────────────── 6. RPCs DE VÍNCULO ───────────────────────────
-- Reusa o MESMO código de 6 caracteres que a família já tem
-- (neurodivergente.codigo_vinculo) — o adolescente não precisa
-- gerar/compartilhar um segundo código. Ao contrário de
-- aceitar_vinculo() (família), não exige id_responsavel IS NULL:
-- vários psicólogos e um cuidador podem coexistir vinculados ao
-- mesmo adolescente. `verificado = false` (CRP ainda não conferido,
-- ver seção 1b) barra o vínculo aqui — não só na UI — porque é o
-- único jeito de garantir que ninguém vincula a um paciente batendo
-- direto no PostgREST/RPC sem passar pela tela.
create or replace function public.aceitar_vinculo_psicologo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teen_id    uuid;
  v_tipo       text;
  v_verificado boolean;
begin
  select tipo, verificado into v_tipo, v_verificado from profiles where id = auth.uid();
  if v_tipo is distinct from 'psicologo' then
    return 'tipo_invalido';
  end if;
  if v_verificado is distinct from true then
    return 'nao_verificado';
  end if;

  select id into v_teen_id from neurodivergente
   where codigo_vinculo = upper(p_codigo);

  if v_teen_id is null then
    return 'codigo_invalido';
  end if;

  if exists (
    select 1 from vinculos_psicologo
     where id_psicologo = auth.uid() and id_neurodivergente = v_teen_id
  ) then
    return 'ja_vinculado';
  end if;

  insert into vinculos_psicologo (id_psicologo, id_neurodivergente)
  values (auth.uid(), v_teen_id);

  return 'ok';
end;
$$;

grant execute on function public.aceitar_vinculo_psicologo(text) to authenticated;

-- Encerra só o vínculo do psicólogo que chamou. NÃO gira o
-- codigo_vinculo (ao contrário de suspender_vinculo, da família) —
-- o código é compartilhado, e girar quebraria o vínculo de qualquer
-- outro psicólogo ou do cuidador que ainda o esteja usando.
create or replace function public.suspender_vinculo_psicologo(p_teen_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from vinculos_psicologo
   where id_psicologo = auth.uid() and id_neurodivergente = p_teen_id;

  return 'ok';
end;
$$;

grant execute on function public.suspender_vinculo_psicologo(uuid) to authenticated;

-- ============================================================
-- Conferência rápida depois de rodar:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.profiles'::regclass and contype = 'c';
--   select * from information_schema.tables
--     where table_name in ('vinculos_psicologo','notas_clinicas');
--   select policyname from pg_policies where tablename in
--     ('profiles','neurodivergente','humores','alertas','relatorios')
--     and policyname like '%psicologo%';
--
-- APROVAR UM PSICÓLOGO (sem tela de admin, direto no SQL Editor do
-- Supabase ou via Management API):
--   -- ver quem está esperando revisão:
--   select id, nome, sobrenome, crp, criado_em from profiles
--     where tipo = 'psicologo' and verificado = false order by criado_em;
--   -- aprovar depois de conferir o CRP:
--   update profiles set verificado = true where id = '<uuid-da-conta>';
-- ============================================================
