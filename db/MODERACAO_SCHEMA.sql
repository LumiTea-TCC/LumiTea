-- ============================================================
-- LumiTEA — MODERACAO_SCHEMA.sql
-- Segurança da Comunidade: bloqueio temporário + filtro no servidor.
-- Idempotente: pode rodar de novo. Rode no SQL Editor do Supabase
-- (ou pela Management API — ver CLAUDE.md).
--
-- POR QUE ISSO EXISTE NO BANCO E NÃO SÓ NO NAVEGADOR
-- O filtro de js/core/moderacao.js dá a resposta imediata e acolhedora,
-- mas ele mora no cliente: recarregar a página, limpar o localStorage ou
-- abrir o DevTools contornaria tudo. Aqui ficam as duas garantias que o
-- navegador não pode dar:
--   1. o RLS recusa insert de quem está em pausa;
--   2. um gatilho relê o texto e DESCARTA a linha se ela passou.
--
-- POR QUE O GATILHO DESCARTA EM VEZ DE DAR ERRO
-- `raise exception` desfaz a transação inteira — inclusive o registro do
-- bloqueio e o alerta que o próprio gatilho acabou de gravar. Devolvendo
-- NULL, a linha ofensiva não entra, mas o registro fica. O cliente
-- percebe porque o insert volta sem linha (ele pede `.select().single()`)
-- e chama Moderacao.conferirSumico().
--
-- O QUE NÃO É GUARDADO: o texto da mensagem bloqueada. O alerta que vai
-- pro cuidador diz o assunto e onde aconteceu, nunca o que a criança
-- escreveu. Espaço de saúde mental de menor: o mínimo necessário.
-- ============================================================

create extension if not exists pgcrypto;

-- ─────────────────────── 1. BLOQUEIOS ───────────────────────
create table if not exists comunidade_bloqueios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nivel      text not null default 'ofensa',
  categoria  text not null default 'desconhecida',
  contexto   text not null default 'comunidade',   -- mural | comentario | chat
  criado_em  timestamptz not null default now(),
  ate        timestamptz not null,
  permanente boolean not null default false         -- 4ª+ ofensa: só o cuidador libera (ver liberar_bloqueio_comunidade)
);
create index if not exists idx_com_bloq_user on comunidade_bloqueios (user_id, ate desc);

-- Aditivo: instalação existente que rodou este arquivo antes de `permanente`
-- existir. Sem efeito numa instalação nova (a coluna já nasce na CREATE TABLE
-- acima). Mesmo padrão de migração aditiva usado em `nascimento`/`apelido`
-- de `neurodivergente` (ver CLAUDE.md).
alter table comunidade_bloqueios add column if not exists permanente boolean not null default false;

alter table comunidade_bloqueios enable row level security;

-- Cada um vê a própria pausa (a tela precisa do horário de volta)...
drop policy if exists com_bloq_self on comunidade_bloqueios;
create policy com_bloq_self on comunidade_bloqueios
  for select to authenticated
  using (user_id = auth.uid());

-- ...e o cuidador vê as dos adolescentes vinculados a ele.
drop policy if exists com_bloq_resp on comunidade_bloqueios;
create policy com_bloq_resp on comunidade_bloqueios
  for select to authenticated
  using (user_id in (select id from neurodivergente where id_responsavel = auth.uid()));

-- SEM política de insert/update/delete, de propósito: se o adolescente
-- pudesse escrever aqui, bastaria um UPDATE com `ate` no passado pra
-- encerrar a própria pausa. Só as funções SECURITY DEFINER abaixo gravam.

-- ─────────────────────── 2. TERMOS ──────────────────────────
-- A lista é cópia da que vive em js/core/moderacao.js, gerada por
-- `node tools/gerar-termos-sql.js`. NÃO edite os termos aqui à mão.
create table if not exists moderacao_termos (
  termo     text primary key,
  nivel     text not null check (nivel in ('risco','cuidado','ofensa','excecao')),
  categoria text not null default 'geral'
);
create index if not exists idx_mod_termos_nivel on moderacao_termos (nivel);

-- RLS ligado e nenhuma política: a lista não é legível pela API. As
-- funções abaixo são SECURITY DEFINER e leem como dona da tabela.
alter table moderacao_termos enable row level security;
revoke all on table moderacao_termos from anon, authenticated;

-- ────────────────── 3. NORMALIZAÇÃO E ANÁLISE ───────────────
-- Espelha normalizar() do js/core/moderacao.js: minúsculo, sem acento,
-- dígito/símbolo de "leet" viram letra, pontuação vira espaço e 3+
-- repetições da mesma letra viram uma ("fodaaaa" → "foda"). Devolve
-- cercado de espaço, pra busca por palavra inteira.
create or replace function public.mod_normalizar(t text)
returns text
language sql
immutable
as $$
  select ' ' || btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(t, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ013457@$!|',
          'aaaaaeeeeiiiiooooouuuucnoieast' || 'asii'
        ),
        '[^a-z0-9]+', ' ', 'g'),
      '([a-z])\1{2,}', '\1', 'g')
  ) || ' ';
$$;

-- Devolve no máximo uma linha: o achado mais grave. Ordem igual à do
-- cliente — risco antes de ofensa, porque uma frase de crise que também
-- tem palavrão é crise, e crise nunca bloqueia ninguém.
create or replace function public.mod_analisar(t text)
returns table (nivel text, categoria text, termo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n text;
  e record;
begin
  n := public.mod_normalizar(t);

  -- exceções saem do texto antes da busca: "matar aula" não é ameaça
  for e in select mt.termo from moderacao_termos mt where mt.nivel = 'excecao' loop
    while position(' ' || e.termo || ' ' in n) > 0 loop
      n := replace(n, ' ' || e.termo || ' ', ' ');
    end loop;
  end loop;

  return query
    select mt.nivel, mt.categoria, mt.termo
      from moderacao_termos mt
     where mt.nivel in ('risco', 'ofensa', 'cuidado')
       and position(' ' || mt.termo || ' ' in n) > 0
     order by case mt.nivel when 'risco' then 1 when 'ofensa' then 2 else 3 end,
              length(mt.termo) desc
     limit 1;
end;
$$;

-- ──────────────── 4. ESTADO E REGISTRO DA OCORRÊNCIA ────────
create or replace function public.estou_bloqueado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from comunidade_bloqueios b
     where b.user_id = auth.uid() and b.ate > now()
  );
$$;

-- Texto do alerta que o cuidador lê. Sem o conteúdo da mensagem.
create or replace function public.mod_descricao(p_nivel text, p_categoria text, p_contexto text)
returns text
language sql
immutable
as $$
  select case p_categoria
    when 'suicidio'       then 'Sinais de pensamento suicida'
    when 'autolesao'      then 'Sinais de automutilação'
    when 'abuso'          then 'Relato que pode indicar violência ou abuso'
    when 'dados_pessoais' then 'Tentou compartilhar dado pessoal ou contato'
    when 'sexualidade'    then 'Dúvida sobre sexualidade'
    when 'substancias'    then 'Menção a álcool ou outras drogas'
    when 'autoimagem'     then 'Falou de si mesmo de forma muito dura'
    when 'xingamento'     then 'Uso de xingamento'
    when 'odio'           then 'Uso de termo ofensivo ou discriminatório'
    when 'ameaca'         then 'Ameaça de violência'
    when 'bullying'       then 'Mensagem agressiva dirigida a outra pessoa'
    when 'pornografia'    then 'Conteúdo sexual explícito'
    when 'crime'          then 'Menção a atividade ilegal'
    else 'Conteúdo bloqueado pela moderação'
  end
  || ' — ' || case p_contexto
    when 'mural'      then 'no mural da comunidade'
    when 'comentario' then 'em um comentário da comunidade'
    when 'chat'       then 'no chat da comunidade'
    else 'na comunidade'
  end
  || case when p_nivel = 'ofensa' then '. A comunidade ficou em pausa por 1 hora.' else '.' end
  || ' A mensagem não foi publicada e o texto não foi guardado.';
$$;

-- Coração do registro: grava a pausa (só em 'ofensa') e o alerta pro
-- cuidador. Usada pelas DUAS entradas — a RPC chamada pelo navegador e o
-- gatilho — pra que o alerta saia igual venha de onde vier.
--
-- Escalada por reincidência (2026-08-19): conta quantas pausas 'ofensa'
-- esse usuário já teve, SEM filtro de data (acumula pra sempre, decisão
-- combinada). 1ª ofensa = 1h, 2ª = 1 dia, 3ª = 3 dias, 4ª em diante =
-- `permanente` (só some com `liberar_bloqueio_comunidade`, chamável só
-- pelo cuidador vinculado). O `ate` do bloqueio permanente é só uma
-- sentinela bem no futuro pra `estou_bloqueado()` continuar funcionando
-- sem mudança — a checagem "é banimento de verdade" é a coluna `permanente`.
create or replace function public.mod_registrar(p_nivel text, p_categoria text, p_contexto text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ate         timestamptz;
  v_uid         uuid := auth.uid();
  v_tipo        text;
  v_ofensas_ant integer;
  v_permanente  boolean := false;
begin
  if v_uid is null then return null; end if;

  if p_nivel = 'ofensa' then
    select count(*) into v_ofensas_ant
      from comunidade_bloqueios
     where user_id = v_uid and nivel = 'ofensa';

    if v_ofensas_ant >= 3 then
      v_permanente := true;
      v_ate := now() + interval '100 years';
    elsif v_ofensas_ant = 2 then
      v_ate := now() + interval '3 days';
    elsif v_ofensas_ant = 1 then
      v_ate := now() + interval '1 day';
    else
      v_ate := now() + interval '1 hour';
    end if;

    insert into comunidade_bloqueios (user_id, nivel, categoria, contexto, ate, permanente)
    values (v_uid, p_nivel, p_categoria, p_contexto, v_ate, v_permanente);
  end if;

  -- Alerta só faz sentido pro adolescente: é o painel do cuidador que lê.
  if public.meu_publico() = 'teen' then
    -- Banimento (4ª+ ofensa) sobe pra 'crise': é um padrão sério o
    -- suficiente pra virar alerta crítico (modal bloqueante no painel do
    -- cuidador), não só o aviso comum de uma pausa de 1h.
    v_tipo := case when p_nivel = 'risco' or v_permanente then 'crise' else 'aviso' end;
    -- Trava anti-enxurrada: no máximo um alerta do mesmo tipo a cada 5
    -- minutos. Sem isso, uma criança testando o filtro entope o painel
    -- e o cuidador para de olhar justamente quando importa. Como o
    -- banimento vira 'crise' (tipo diferente do 'aviso' das ofensas
    -- comuns), ele nunca é engolido pela trava de uma ofensa recente.
    if not exists (
      select 1 from alertas a
       where a.id_neurodivergente = v_uid
         and a.tipo = v_tipo
         and a.titulo like 'Comunidade:%'
         and a.timestamp > now() - interval '5 minutes'
    ) then
      insert into alertas (id_neurodivergente, tipo, titulo, descricao, destino)
      values (v_uid, v_tipo,
              case when p_nivel = 'risco'
                     then 'Comunidade: sinal de sofrimento'
                   when v_permanente
                     then 'Comunidade: banido da comunidade após reincidência'
                   else 'Comunidade: mensagem bloqueada' end,
              public.mod_descricao(p_nivel, p_categoria, p_contexto),
              'responsavel');
    end if;
  end if;

  return v_ate;
end;
$$;

-- Só o cuidador vinculado libera um bloqueio (temporário ou permanente) —
-- mesmo padrão de autorização de `suspender_vinculo`. Não existe fluxo de
-- "pedido" separado: o cuidador já vê o alerta e libera direto quando achar
-- certo (decisão combinada).
create or replace function public.liberar_bloqueio_comunidade(p_bloqueio_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;

  update comunidade_bloqueios
     set ate = now(), permanente = false
   where id = p_bloqueio_id
     and user_id in (select id from neurodivergente where id_responsavel = v_uid);

  return found;
end;
$$;

revoke all on function public.liberar_bloqueio_comunidade(uuid) from public, anon;
grant execute on function public.liberar_bloqueio_comunidade(uuid) to authenticated;

-- Entrada do navegador: o filtro do cliente pegou algo, avisa o servidor.
-- Devolve o fim da pausa (ou NULL quando o nível não bloqueia).
create or replace function public.registrar_ocorrencia_moderacao(
  p_nivel text, p_categoria text, p_contexto text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sem sessao';
  end if;
  if p_nivel not in ('risco', 'cuidado', 'ofensa') then
    raise exception 'nivel invalido';
  end if;
  return public.mod_registrar(
    p_nivel,
    coalesce(nullif(btrim(p_categoria), ''), 'geral'),
    coalesce(nullif(btrim(p_contexto), ''), 'comunidade')
  );
end;
$$;

revoke all on function public.registrar_ocorrencia_moderacao(text, text, text) from public, anon;
grant execute on function public.registrar_ocorrencia_moderacao(text, text, text) to authenticated;
revoke all on function public.mod_registrar(text, text, text) from public, anon, authenticated;
revoke all on function public.mod_analisar(text) from public, anon, authenticated;

-- ──────────────────────── 5. O GATILHO ──────────────────────
create or replace function public.mod_filtrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a        record;
  v_ctx    text;
begin
  v_ctx := case tg_table_name
    when 'comunidade_posts'       then 'mural'
    when 'comunidade_comentarios' then 'comentario'
    when 'comunidade_chat'        then 'chat'
    else 'comunidade'
  end;

  -- Em pausa: nada entra. O RLS já barra, mas quem chega por outro
  -- caminho (RPC futura, service role mal usada) para aqui.
  if public.estou_bloqueado() then
    return null;
  end if;

  select * into a from public.mod_analisar(new.texto);
  if not found then
    return new;
  end if;

  perform public.mod_registrar(a.nivel, a.categoria, v_ctx);
  return null;   -- descarta a linha; ver o cabeçalho deste arquivo
end;
$$;

drop trigger if exists trg_mod_posts on comunidade_posts;
create trigger trg_mod_posts before insert on comunidade_posts
  for each row execute function public.mod_filtrar();

drop trigger if exists trg_mod_comentarios on comunidade_comentarios;
create trigger trg_mod_comentarios before insert on comunidade_comentarios
  for each row execute function public.mod_filtrar();

drop trigger if exists trg_mod_chat on comunidade_chat;
create trigger trg_mod_chat before insert on comunidade_chat
  for each row execute function public.mod_filtrar();

-- ─────────── 6. RLS: quem está em pausa não escreve ─────────
-- Mesmas políticas de COMUNIDADE_SCHEMA.sql / CHAT_SCHEMA.sql, com a
-- condição de bloqueio no fim. Se aquelas mudarem, mude estas junto.
drop policy if exists com_posts_insert on comunidade_posts;
create policy com_posts_insert on comunidade_posts
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and publico = public.meu_publico()
    and not public.estou_bloqueado()
  );

drop policy if exists com_coment_insert on comunidade_comentarios;
create policy com_coment_insert on comunidade_comentarios
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and not public.estou_bloqueado()
    and exists (
      select 1 from comunidade_posts po
      where po.id = post_id and po.publico = public.meu_publico()
    )
  );

drop policy if exists chat_insert on comunidade_chat;
create policy chat_insert on comunidade_chat
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and publico = public.meu_publico()
    and not public.estou_bloqueado()
  );

-- ═══════════════════════ 7. TERMOS ══════════════════════════
-- >>> TERMOS-GERADOS-INICIO
-- GERADO por `node tools/gerar-termos-sql.js` a partir de js/core/moderacao.js.
-- NÃO EDITE À MÃO: a próxima execução sobrescreve este bloco.
-- 355 termos (cuidado: 69, excecao: 32, ofensa: 168, risco: 86).

delete from moderacao_termos;
insert into moderacao_termos (termo, nivel, categoria) values
  ('suicidio', 'risco', 'suicidio'),
  ('suicida', 'risco', 'suicidio'),
  ('me suicidar', 'risco', 'suicidio'),
  ('se suicidar', 'risco', 'suicidio'),
  ('cometer suicidio', 'risco', 'suicidio'),
  ('me matar', 'risco', 'suicidio'),
  ('vou me matar', 'risco', 'suicidio'),
  ('quero me matar', 'risco', 'suicidio'),
  ('pensando em me matar', 'risco', 'suicidio'),
  ('penso em me matar', 'risco', 'suicidio'),
  ('tirar minha vida', 'risco', 'suicidio'),
  ('tirar a minha vida', 'risco', 'suicidio'),
  ('acabar com a minha vida', 'risco', 'suicidio'),
  ('dar fim na minha vida', 'risco', 'suicidio'),
  ('dar fim a minha vida', 'risco', 'suicidio'),
  ('por um fim na minha vida', 'risco', 'suicidio'),
  ('quero morrer', 'risco', 'suicidio'),
  ('queria morrer', 'risco', 'suicidio'),
  ('so quero morrer', 'risco', 'suicidio'),
  ('preferia morrer', 'risco', 'suicidio'),
  ('melhor morrer', 'risco', 'suicidio'),
  ('desejo morrer', 'risco', 'suicidio'),
  ('vontade de morrer', 'risco', 'suicidio'),
  ('nao quero viver', 'risco', 'suicidio'),
  ('nao quero mais viver', 'risco', 'suicidio'),
  ('nao aguento mais viver', 'risco', 'suicidio'),
  ('cansei de viver', 'risco', 'suicidio'),
  ('desisti de viver', 'risco', 'suicidio'),
  ('sem vontade de viver', 'risco', 'suicidio'),
  ('a vida nao vale a pena', 'risco', 'suicidio'),
  ('nao vejo saida', 'risco', 'suicidio'),
  ('nao tem saida pra mim', 'risco', 'suicidio'),
  ('sumir do mundo', 'risco', 'suicidio'),
  ('sumir pra sempre', 'risco', 'suicidio'),
  ('desaparecer pra sempre', 'risco', 'suicidio'),
  ('acabar com tudo', 'risco', 'suicidio'),
  ('ninguem sentiria minha falta', 'risco', 'suicidio'),
  ('ninguem vai sentir minha falta', 'risco', 'suicidio'),
  ('seria melhor se eu morresse', 'risco', 'suicidio'),
  ('seria melhor sem mim', 'risco', 'suicidio'),
  ('o mundo seria melhor sem mim', 'risco', 'suicidio'),
  ('todo mundo ficaria melhor sem mim', 'risco', 'suicidio'),
  ('carta de despedida', 'risco', 'suicidio'),
  ('me despedir de todo mundo', 'risco', 'suicidio'),
  ('me enforcar', 'risco', 'suicidio'),
  ('me jogar da janela', 'risco', 'suicidio'),
  ('me jogar do predio', 'risco', 'suicidio'),
  ('pular do predio', 'risco', 'suicidio'),
  ('tomar todos os remedios', 'risco', 'suicidio'),
  ('overdose de remedio', 'risco', 'suicidio'),
  ('cartela inteira de remedio', 'risco', 'suicidio'),
  ('me cortar', 'risco', 'autolesao'),
  ('me cortando', 'risco', 'autolesao'),
  ('me cortei', 'risco', 'autolesao'),
  ('cortar o pulso', 'risco', 'autolesao'),
  ('cortar os pulsos', 'risco', 'autolesao'),
  ('me machucar', 'risco', 'autolesao'),
  ('me machuquei de proposito', 'risco', 'autolesao'),
  ('me ferir', 'risco', 'autolesao'),
  ('automutilacao', 'risco', 'autolesao'),
  ('auto mutilacao', 'risco', 'autolesao'),
  ('autolesao', 'risco', 'autolesao'),
  ('auto lesao', 'risco', 'autolesao'),
  ('me queimar de proposito', 'risco', 'autolesao'),
  ('arranhar ate sangrar', 'risco', 'autolesao'),
  ('ate sangrar', 'risco', 'autolesao'),
  ('abuso sexual', 'risco', 'abuso'),
  ('me abusou', 'risco', 'abuso'),
  ('abusaram de mim', 'risco', 'abuso'),
  ('fui abusada', 'risco', 'abuso'),
  ('fui abusado', 'risco', 'abuso'),
  ('ele me tocou', 'risco', 'abuso'),
  ('ela me tocou', 'risco', 'abuso'),
  ('me tocou sem eu querer', 'risco', 'abuso'),
  ('tocou minhas partes', 'risco', 'abuso'),
  ('me obrigou a fazer', 'risco', 'abuso'),
  ('pedofilo', 'risco', 'abuso'),
  ('pedofila', 'risco', 'abuso'),
  ('pedofilia', 'risco', 'abuso'),
  ('meu pai me bate', 'risco', 'abuso'),
  ('minha mae me bate', 'risco', 'abuso'),
  ('apanho em casa', 'risco', 'abuso'),
  ('apanhei em casa', 'risco', 'abuso'),
  ('me batem em casa', 'risco', 'abuso'),
  ('me trancam', 'risco', 'abuso'),
  ('me deixam sem comer', 'risco', 'abuso'),
  ('meu whatsapp', 'cuidado', 'dados_pessoais'),
  ('meu zap', 'cuidado', 'dados_pessoais'),
  ('me chama no zap', 'cuidado', 'dados_pessoais'),
  ('me chama no whats', 'cuidado', 'dados_pessoais'),
  ('meu numero e', 'cuidado', 'dados_pessoais'),
  ('meu telefone e', 'cuidado', 'dados_pessoais'),
  ('qual seu numero', 'cuidado', 'dados_pessoais'),
  ('manda seu numero', 'cuidado', 'dados_pessoais'),
  ('manda seu whatsapp', 'cuidado', 'dados_pessoais'),
  ('manda seu zap', 'cuidado', 'dados_pessoais'),
  ('meu insta e', 'cuidado', 'dados_pessoais'),
  ('meu instagram e', 'cuidado', 'dados_pessoais'),
  ('me segue no insta', 'cuidado', 'dados_pessoais'),
  ('meu discord', 'cuidado', 'dados_pessoais'),
  ('me chama no discord', 'cuidado', 'dados_pessoais'),
  ('meu telegram', 'cuidado', 'dados_pessoais'),
  ('me chama no telegram', 'cuidado', 'dados_pessoais'),
  ('meu tiktok e', 'cuidado', 'dados_pessoais'),
  ('qual seu endereco', 'cuidado', 'dados_pessoais'),
  ('meu endereco e', 'cuidado', 'dados_pessoais'),
  ('onde voce mora', 'cuidado', 'dados_pessoais'),
  ('onde vc mora', 'cuidado', 'dados_pessoais'),
  ('onde tu mora', 'cuidado', 'dados_pessoais'),
  ('minha escola e', 'cuidado', 'dados_pessoais'),
  ('estudo na escola', 'cuidado', 'dados_pessoais'),
  ('manda sua localizacao', 'cuidado', 'dados_pessoais'),
  ('manda sua foto', 'cuidado', 'dados_pessoais'),
  ('manda uma foto sua', 'cuidado', 'dados_pessoais'),
  ('manda foto do seu rosto', 'cuidado', 'dados_pessoais'),
  ('liga a camera', 'cuidado', 'dados_pessoais'),
  ('chamada de video comigo', 'cuidado', 'dados_pessoais'),
  ('me chama no privado', 'cuidado', 'dados_pessoais'),
  ('fala comigo no pv', 'cuidado', 'dados_pessoais'),
  ('vamos nos encontrar', 'cuidado', 'dados_pessoais'),
  ('nos encontrar pessoalmente', 'cuidado', 'dados_pessoais'),
  ('quero te conhecer pessoalmente', 'cuidado', 'dados_pessoais'),
  ('me encontra depois da aula', 'cuidado', 'dados_pessoais'),
  ('nao conta pros seus pais', 'cuidado', 'dados_pessoais'),
  ('nao conta pra sua mae', 'cuidado', 'dados_pessoais'),
  ('nao conta pra ninguem', 'cuidado', 'dados_pessoais'),
  ('segredo nosso', 'cuidado', 'dados_pessoais'),
  ('fica entre nos dois', 'cuidado', 'dados_pessoais'),
  ('sexo', 'cuidado', 'sexualidade'),
  ('fazer sexo', 'cuidado', 'sexualidade'),
  ('transar', 'cuidado', 'sexualidade'),
  ('transei', 'cuidado', 'sexualidade'),
  ('perder a virgindade', 'cuidado', 'sexualidade'),
  ('virgindade', 'cuidado', 'sexualidade'),
  ('maconha', 'cuidado', 'substancias'),
  ('fumar maconha', 'cuidado', 'substancias'),
  ('cocaina', 'cuidado', 'substancias'),
  ('crack', 'cuidado', 'substancias'),
  ('lsd', 'cuidado', 'substancias'),
  ('ecstasy', 'cuidado', 'substancias'),
  ('heroina', 'cuidado', 'substancias'),
  ('metanfetamina', 'cuidado', 'substancias'),
  ('lanca perfume', 'cuidado', 'substancias'),
  ('cheirar cola', 'cuidado', 'substancias'),
  ('usar droga', 'cuidado', 'substancias'),
  ('usar drogas', 'cuidado', 'substancias'),
  ('comprar droga', 'cuidado', 'substancias'),
  ('comprar drogas', 'cuidado', 'substancias'),
  ('ficar chapado', 'cuidado', 'substancias'),
  ('ficar doidao', 'cuidado', 'substancias'),
  ('encher a cara', 'cuidado', 'substancias'),
  ('beber ate cair', 'cuidado', 'substancias'),
  ('ficar bebado', 'cuidado', 'substancias'),
  ('vape', 'cuidado', 'substancias'),
  ('cigarro eletronico', 'cuidado', 'substancias'),
  ('fdp', 'ofensa', 'xingamento'),
  ('filho da puta', 'ofensa', 'xingamento'),
  ('filha da puta', 'ofensa', 'xingamento'),
  ('puta que pariu', 'ofensa', 'xingamento'),
  ('puta', 'ofensa', 'xingamento'),
  ('putinha', 'ofensa', 'xingamento'),
  ('foda se', 'ofensa', 'xingamento'),
  ('fodase', 'ofensa', 'xingamento'),
  ('vai se foder', 'ofensa', 'xingamento'),
  ('vai se fuder', 'ofensa', 'xingamento'),
  ('se fode', 'ofensa', 'xingamento'),
  ('foda', 'ofensa', 'xingamento'),
  ('vai tomar no cu', 'ofensa', 'xingamento'),
  ('tomar no cu', 'ofensa', 'xingamento'),
  ('toma no cu', 'ofensa', 'xingamento'),
  ('vtnc', 'ofensa', 'xingamento'),
  ('caralho', 'ofensa', 'xingamento'),
  ('krl', 'ofensa', 'xingamento'),
  ('porra', 'ofensa', 'xingamento'),
  ('merda', 'ofensa', 'xingamento'),
  ('bosta', 'ofensa', 'xingamento'),
  ('buceta', 'ofensa', 'xingamento'),
  ('boceta', 'ofensa', 'xingamento'),
  ('xoxota', 'ofensa', 'xingamento'),
  ('cu', 'ofensa', 'xingamento'),
  ('cuzao', 'ofensa', 'xingamento'),
  ('arrombado', 'ofensa', 'xingamento'),
  ('arrombada', 'ofensa', 'xingamento'),
  ('corno', 'ofensa', 'xingamento'),
  ('corna', 'ofensa', 'xingamento'),
  ('escroto', 'ofensa', 'xingamento'),
  ('escrota', 'ofensa', 'xingamento'),
  ('desgracado', 'ofensa', 'xingamento'),
  ('desgracada', 'ofensa', 'xingamento'),
  ('vagabundo', 'ofensa', 'xingamento'),
  ('vagabunda', 'ofensa', 'xingamento'),
  ('vadia', 'ofensa', 'xingamento'),
  ('piranha', 'ofensa', 'xingamento'),
  ('safado', 'ofensa', 'xingamento'),
  ('safada', 'ofensa', 'xingamento'),
  ('pilantra', 'ofensa', 'xingamento'),
  ('canalha', 'ofensa', 'xingamento'),
  ('miseravel', 'ofensa', 'xingamento'),
  ('verme', 'ofensa', 'xingamento'),
  ('pentelho', 'ofensa', 'xingamento'),
  ('otario', 'ofensa', 'xingamento'),
  ('otaria', 'ofensa', 'xingamento'),
  ('retardado', 'ofensa', 'odio'),
  ('retardada', 'ofensa', 'odio'),
  ('retardo', 'ofensa', 'odio'),
  ('mongoloide', 'ofensa', 'odio'),
  ('mongol', 'ofensa', 'odio'),
  ('debil mental', 'ofensa', 'odio'),
  ('aleijado', 'ofensa', 'odio'),
  ('aleijada', 'ofensa', 'odio'),
  ('capenga', 'ofensa', 'odio'),
  ('viado', 'ofensa', 'odio'),
  ('viadinho', 'ofensa', 'odio'),
  ('bicha', 'ofensa', 'odio'),
  ('baitola', 'ofensa', 'odio'),
  ('boiola', 'ofensa', 'odio'),
  ('traveco', 'ofensa', 'odio'),
  ('sapatao', 'ofensa', 'odio'),
  ('crioulo', 'ofensa', 'odio'),
  ('preto fedido', 'ofensa', 'odio'),
  ('preta fedida', 'ofensa', 'odio'),
  ('preto imundo', 'ofensa', 'odio'),
  ('volta pra senzala', 'ofensa', 'odio'),
  ('seu macaco', 'ofensa', 'odio'),
  ('sua macaca', 'ofensa', 'odio'),
  ('nazista', 'ofensa', 'odio'),
  ('heil hitler', 'ofensa', 'odio'),
  ('viva hitler', 'ofensa', 'odio'),
  ('hitler tinha razao', 'ofensa', 'odio'),
  ('supremacia branca', 'ofensa', 'odio'),
  ('vou te matar', 'ofensa', 'ameaca'),
  ('vou matar voce', 'ofensa', 'ameaca'),
  ('vou matar vc', 'ofensa', 'ameaca'),
  ('te matar', 'ofensa', 'ameaca'),
  ('te mato', 'ofensa', 'ameaca'),
  ('vou te bater', 'ofensa', 'ameaca'),
  ('vou te socar', 'ofensa', 'ameaca'),
  ('vou te dar uma surra', 'ofensa', 'ameaca'),
  ('vou te esfaquear', 'ofensa', 'ameaca'),
  ('quebrar sua cara', 'ofensa', 'ameaca'),
  ('arrebentar sua cara', 'ofensa', 'ameaca'),
  ('vou acabar com voce', 'ofensa', 'ameaca'),
  ('vou acabar com vc', 'ofensa', 'ameaca'),
  ('sei onde voce mora', 'ofensa', 'ameaca'),
  ('sei onde vc mora', 'ofensa', 'ameaca'),
  ('vou te achar', 'ofensa', 'ameaca'),
  ('te espero na saida', 'ofensa', 'ameaca'),
  ('te encontro na saida', 'ofensa', 'ameaca'),
  ('levar faca pra escola', 'ofensa', 'ameaca'),
  ('levar arma pra escola', 'ofensa', 'ameaca'),
  ('atirar na escola', 'ofensa', 'ameaca'),
  ('atirar em todo mundo', 'ofensa', 'ameaca'),
  ('matar todo mundo', 'ofensa', 'ameaca'),
  ('matar geral', 'ofensa', 'ameaca'),
  ('fazer um massacre', 'ofensa', 'ameaca'),
  ('tiroteio na escola', 'ofensa', 'ameaca'),
  ('explodir a escola', 'ofensa', 'ameaca'),
  ('se mata', 'ofensa', 'bullying'),
  ('vai se matar', 'ofensa', 'bullying'),
  ('se mata logo', 'ofensa', 'bullying'),
  ('morre logo', 'ofensa', 'bullying'),
  ('vai morrer logo', 'ofensa', 'bullying'),
  ('ninguem gosta de voce', 'ofensa', 'bullying'),
  ('ninguem gosta de vc', 'ofensa', 'bullying'),
  ('ninguem te aguenta', 'ofensa', 'bullying'),
  ('ninguem te suporta', 'ofensa', 'bullying'),
  ('voce e um erro', 'ofensa', 'bullying'),
  ('vc e um erro', 'ofensa', 'bullying'),
  ('voce nao deveria ter nascido', 'ofensa', 'bullying'),
  ('vc nao deveria ter nascido', 'ofensa', 'bullying'),
  ('o mundo seria melhor sem voce', 'ofensa', 'bullying'),
  ('ninguem sentiria sua falta', 'ofensa', 'bullying'),
  ('volta pro seu buraco', 'ofensa', 'bullying'),
  ('some da comunidade', 'ofensa', 'bullying'),
  ('porno', 'ofensa', 'pornografia'),
  ('pornografia', 'ofensa', 'pornografia'),
  ('pornhub', 'ofensa', 'pornografia'),
  ('xvideos', 'ofensa', 'pornografia'),
  ('xnxx', 'ofensa', 'pornografia'),
  ('onlyfans', 'ofensa', 'pornografia'),
  ('hentai', 'ofensa', 'pornografia'),
  ('rule34', 'ofensa', 'pornografia'),
  ('nsfw', 'ofensa', 'pornografia'),
  ('nudes', 'ofensa', 'pornografia'),
  ('nude', 'ofensa', 'pornografia'),
  ('manda nudes', 'ofensa', 'pornografia'),
  ('mandar nudes', 'ofensa', 'pornografia'),
  ('pack de nudes', 'ofensa', 'pornografia'),
  ('vender pack', 'ofensa', 'pornografia'),
  ('foto pelada', 'ofensa', 'pornografia'),
  ('fotos peladas', 'ofensa', 'pornografia'),
  ('video de sexo', 'ofensa', 'pornografia'),
  ('se masturbar', 'ofensa', 'pornografia'),
  ('masturbacao', 'ofensa', 'pornografia'),
  ('punheta', 'ofensa', 'pornografia'),
  ('siririca', 'ofensa', 'pornografia'),
  ('pau duro', 'ofensa', 'pornografia'),
  ('rola dura', 'ofensa', 'pornografia'),
  ('gozar', 'ofensa', 'pornografia'),
  ('gozada', 'ofensa', 'pornografia'),
  ('tesao', 'ofensa', 'pornografia'),
  ('sexo anal', 'ofensa', 'pornografia'),
  ('sexo oral', 'ofensa', 'pornografia'),
  ('boquete', 'ofensa', 'pornografia'),
  ('chupar o pau', 'ofensa', 'pornografia'),
  ('novinha safada', 'ofensa', 'pornografia'),
  ('como roubar', 'ofensa', 'crime'),
  ('vamos roubar', 'ofensa', 'crime'),
  ('roubar uma loja', 'ofensa', 'crime'),
  ('assaltar', 'ofensa', 'crime'),
  ('assalto a mao armada', 'ofensa', 'crime'),
  ('vender droga', 'ofensa', 'crime'),
  ('vender drogas', 'ofensa', 'crime'),
  ('traficar', 'ofensa', 'crime'),
  ('trafico de drogas', 'ofensa', 'crime'),
  ('comprar arma', 'ofensa', 'crime'),
  ('arma ilegal', 'ofensa', 'crime'),
  ('fazer uma bomba', 'ofensa', 'crime'),
  ('bomba caseira', 'ofensa', 'crime'),
  ('coquetel molotov', 'ofensa', 'crime'),
  ('como hackear', 'ofensa', 'crime'),
  ('clonar cartao', 'ofensa', 'crime'),
  ('cartao roubado', 'ofensa', 'crime'),
  ('matar aula', 'excecao', 'geral'),
  ('matar a aula', 'excecao', 'geral'),
  ('matar a saudade', 'excecao', 'geral'),
  ('matar o tempo', 'excecao', 'geral'),
  ('matar a charada', 'excecao', 'geral'),
  ('matar a curiosidade', 'excecao', 'geral'),
  ('matar o boss', 'excecao', 'geral'),
  ('matar o chefe', 'excecao', 'geral'),
  ('matar zumbi', 'excecao', 'geral'),
  ('matar zumbis', 'excecao', 'geral'),
  ('matar mob', 'excecao', 'geral'),
  ('matar mobs', 'excecao', 'geral'),
  ('matar no jogo', 'excecao', 'geral'),
  ('matar a fome', 'excecao', 'geral'),
  ('matar a sede', 'excecao', 'geral'),
  ('morrer de rir', 'excecao', 'geral'),
  ('morrer de fome', 'excecao', 'geral'),
  ('morrer de sono', 'excecao', 'geral'),
  ('morrer de calor', 'excecao', 'geral'),
  ('morrer de frio', 'excecao', 'geral'),
  ('morrer de vergonha', 'excecao', 'geral'),
  ('morrer de amores', 'excecao', 'geral'),
  ('morrer de medo', 'excecao', 'geral'),
  ('de morrer de', 'excecao', 'geral'),
  ('sexo masculino', 'excecao', 'geral'),
  ('sexo feminino', 'excecao', 'geral'),
  ('sexo biologico', 'excecao', 'geral'),
  ('educacao sexual', 'excecao', 'geral'),
  ('jogar pelada', 'excecao', 'geral'),
  ('uma pelada', 'excecao', 'geral'),
  ('pelada de rua', 'excecao', 'geral'),
  ('porra louca', 'excecao', 'geral');

-- <<< TERMOS-GERADOS-FIM

-- ============================================================
-- Pronto. Conferência rápida depois de rodar:
--   select nivel, count(*) from moderacao_termos group by nivel;
--   select * from public.mod_analisar('vou te matar');      -- ofensa/ameaca
--   select * from public.mod_analisar('vou matar o boss');  -- nenhuma linha
--   select * from public.mod_analisar('quero morrer');      -- risco/suicidio
-- ============================================================
