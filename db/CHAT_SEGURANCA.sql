-- ============================================================
-- LumiTEA — CHAT_SEGURANCA.sql
-- Bloqueio de segurança do chat da comunidade (só adolescentes).
--
-- Fluxo: ao detectar sinal de risco (autolesão/suicídio) ou linguagem
-- ofensiva na mensagem, o CLIENTE (js/chat.js) não insere o texto na
-- sala — chama registrar_bloqueio_chat() em vez disso, que:
--   1. grava um bloqueio de 1h em chat_bloqueios;
--   2. avisa o responsável vinculado via a tabela `alertas` já existente
--      (tipo 'crise' p/ risco, 'aviso' p/ linguagem ofensiva).
--
-- O teen NÃO tem permissão de escrita direta em chat_bloqueios — só a
-- função abaixo (SECURITY DEFINER) grava — então não dá pra se
-- autodesbloquear só limpando estado local/editando pelo cliente.
-- A policy de INSERT de comunidade_chat também passa a negar mensagem
-- de quem estiver bloqueado: reforço no banco, não só no cliente (que
-- sempre pode ser burlado por um cliente HTTP direto).
--
-- Idempotente: pode rodar de novo. Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists chat_bloqueios (
  id                 uuid primary key default gen_random_uuid(),
  id_neurodivergente uuid not null references profiles(id) on delete cascade,
  bloqueado_ate      timestamptz not null,
  motivo             text not null default 'sinal_risco_chat'
                        check (motivo in ('sinal_risco_chat', 'linguagem_ofensiva_chat')),
  criado_em          timestamptz not null default now()
);
create index if not exists idx_chat_bloqueios_teen on chat_bloqueios (id_neurodivergente, bloqueado_ate desc);

alter table chat_bloqueios enable row level security;

-- Só leitura: o próprio adolescente confere se está bloqueado; o responsável
-- vinculado também pode ler (visibilidade, não é mostrado aqui em UI ainda).
-- Não existe policy de insert/update/delete para `authenticated` — só a
-- função SECURITY DEFINER abaixo escreve.
drop policy if exists cb_self_select on chat_bloqueios;
create policy cb_self_select on chat_bloqueios
  for select to authenticated
  using (id_neurodivergente = auth.uid());

drop policy if exists cb_resp_select on chat_bloqueios;
create policy cb_resp_select on chat_bloqueios
  for select to authenticated
  using (
    id_neurodivergente in (
      select id from neurodivergente where id_responsavel = auth.uid()
    )
  );

-- Assinatura antiga (só p_motivo), de antes do trecho entrar no aviso do
-- responsável — remove pra não sobrar função órfã de 1 argumento no banco.
drop function if exists public.registrar_bloqueio_chat(text);

-- Registra o bloqueio de 1h + avisa o responsável, incluindo o trecho
-- exato que o adolescente escreveu (pedido do usuário: o responsável
-- precisa ver a palavra/frase, não só "algo foi bloqueado"). O teen NÃO
-- é informado desse aviso em nenhum momento — isso é feito só no cliente
-- (js/chat.js), aqui é só o registro. auth.uid() é sempre o alvo (não vem
-- por parâmetro) — só dá pra bloquear a si mesmo.
create or replace function public.registrar_bloqueio_chat(p_motivo text default 'sinal_risco_chat', p_trecho text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ate    timestamptz := now() + interval '1 hour';
  v_motivo text := p_motivo;
  v_trecho text := left(coalesce(p_trecho, ''), 200);
  v_tipo   text;
  v_titulo text;
  v_desc   text;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  if v_motivo not in ('sinal_risco_chat', 'linguagem_ofensiva_chat') then
    v_motivo := 'sinal_risco_chat';
  end if;

  insert into chat_bloqueios (id_neurodivergente, bloqueado_ate, motivo)
  values (auth.uid(), v_ate, v_motivo);

  if v_motivo = 'linguagem_ofensiva_chat' then
    v_tipo := 'aviso';
    v_titulo := 'Linguagem inadequada no chat da comunidade';
    v_desc := 'Uma mensagem com linguagem ofensiva foi bloqueada automaticamente.' ||
              (case when v_trecho = '' then '' else ' Trecho: "' || v_trecho || '".' end) ||
              ' Por segurança, o chat da comunidade ficou pausado por 1 hora.';
  else
    v_tipo := 'crise';
    v_titulo := 'Sinal de risco no chat da comunidade';
    v_desc := 'Uma mensagem no chat da comunidade indicou possível risco (autolesão/suicídio).' ||
              (case when v_trecho = '' then '' else ' Trecho: "' || v_trecho || '".' end) ||
              ' Por segurança, o chat ficou pausado por 1 hora.';
  end if;

  insert into alertas (id_neurodivergente, tipo, titulo, descricao, destino)
  values (auth.uid(), v_tipo, v_titulo, v_desc, 'responsavel');

  return v_ate;
end;
$$;

grant execute on function public.registrar_bloqueio_chat(text, text) to authenticated;

-- Reforça no banco: nega o INSERT de quem estiver com bloqueio ativo,
-- além do isolamento por público que já existia.
drop policy if exists chat_insert on comunidade_chat;
create policy chat_insert on comunidade_chat
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and publico = public.meu_publico()
    and not exists (
      select 1 from chat_bloqueios b
      where b.id_neurodivergente = auth.uid() and b.bloqueado_ate > now()
    )
  );

-- ============================================================
-- Pronto. Palavras/frases que disparam o bloqueio ficam no cliente
-- (js/chat.js, SINAIS_RISCO e PALAVRAS_OFENSIVAS) — mudar a lista não
-- exige migração nova.
-- ============================================================
