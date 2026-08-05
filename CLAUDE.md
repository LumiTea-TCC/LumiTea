# CLAUDE.md — LumiTEA

Contexto e regras para o Claude continuar o trabalho neste projeto. Leia antes de editar qualquer coisa.

## O que é
App web de apoio socioemocional para **adolescentes autistas (TEA)** e **pais/cuidadores**.
Duas áreas: **teen (calma)** e **cuidador (sóbria)**. Mascote: urso **Lumi/Theo**.

- Raiz do app: `C:\Users\196402024\LumiTea\` (repo git na mesma pasta).
- Roda **sem servidor** (caminhos relativos). Local: `serve.ps1` / `rodar-local.bat` (= localhost).
- **Não há Node/npx/npm/Supabase CLI instalados nesta máquina** (confirmado em 2026-08-05 — busca completa no
  disco não achou `node.exe`/`supabase.exe`; `python`/`python3` são só o stub da Microsoft Store, sem intérprete
  real). Não assumir CLI disponível — ver "Deploy/admin da Supabase sem CLI" abaixo. Ferramentas que EXISTEM:
  PowerShell (com `ConvertFrom-Json`/`ConvertTo-Json` nativos) e `curl` (mingw64, via Bash tool).

## Stack
- **Frontend:** HTML/CSS/JS **vanilla**, sem framework. (Houve um Next.js em `web/` — ABANDONADO, ignore.)
- **Backend:** **Supabase** (Postgres + Auth + RLS + Edge Functions). Projeto ref: `yuwdckenzpfdlyawkibn`.
- **IA:** Groq (texto). **Voz:** ElevenLabs. Ambas via proxy no servidor (ver Segurança).

## Deploy/admin da Supabase sem CLI
Sem Node/CLI (ver acima), deploy de Edge Function e secrets são feitos direto na **Management API**
(`https://api.supabase.com`) com um **PAT do usuário** (`Authorization: Bearer sbp_...`, gerado em
`supabase.com/dashboard/account/tokens`). Testado e funcionando em 2026-08-05 (deploy do `groq-proxy`):
- **Deploy de function:** `POST /v1/projects/{ref}/functions/deploy?slug=<nome>`, multipart/form-data:
  campo `metadata` (JSON: `{"entrypoint_path":"index.ts","verify_jwt":true,"name":"<nome>"}`) + campo
  `file` (o `index.ts`, com `filename=index.ts`). No `curl` do mingw64 (Git Bash), os caminhos dos arquivos em
  `-F campo=@caminho` **precisam ser estilo Windows com `/`** (ex.: `C:/Users/.../index.ts`) — caminhos
  `/c/Users/...` (estilo MSYS) dão `curl: (26)` (falha ao ler o arquivo).
- **Secrets:** `POST /v1/projects/{ref}/secrets`, body = **array** JSON direto (não objeto): `[{"name":"X","value":"Y"}]`.
- **SQL direto (migrations, checar schema/RLS/functions em produção):** `POST /v1/projects/{ref}/database/query`,
  body `{"query":"<SQL>"}`. Testado e funcionando em 2026-08-05 (criação da função `suspender_vinculo` e
  checagem de colunas/RLS/functions reais do banco). Via `curl`, escapar aspas simples do SQL dentro do JSON
  manualmente. Via **PowerShell, NÃO** montar o body com `Get-Content -Raw arquivo.sql | ...` direto — nesse
  ambiente o objeto retornado às vezes vem decorado (com `.PSPath` etc. grudados na string), e
  `@{query=$sql} | ConvertTo-Json` serializa isso como objeto em vez de string, e a API rejeita com
  `"query: Invalid input: expected string, received object"`. Forçar `$sql = [string](Get-Content -Raw ...)`
  antes de montar o body resolve.
- Spec completa da API (OpenAPI) em `https://api.supabase.com/api/v1-json` — grande demais pro WebFetch
  resumir direto; baixar com `curl` e ler com `ConvertFrom-Json` do PowerShell.
- PAT é sensível: depois de usar, sugerir ao usuário revogar em `supabase.com/dashboard/account/tokens`.

## ⛔ Restrições inegociáveis (o usuário enfatizou)
1. **Paleta de cores e mascote urso são IMUTÁVEIS.** Toda melhoria acontece ao redor disso, nunca por cima.
2. **Público TEA:** acessibilidade WCAG AA, linguagem clara/acolhedora, baixa carga sensorial.
3. **"Modo calmo soberano"** (`html[data-modo-calmo="true"]`) e **`prefers-reduced-motion`**: TODO movimento
   deve estar desligado nesses estados. "Calma é função": motion só de ESTADO, ≤4–6px, 150–260ms, ease-out.
   Sem parallax/zoom/bounce/confete.
4. **Zero estilo inline** novo (usar classes + tokens). Exceção tolerada: definir variáveis locais
   (ex.: `--feature-color`) e `style.display` dinâmico por JS (padrão já usado no projeto).

## Design system (consultar SEMPRE antes de mexer em UI)
- Docs: `DESIGN.md`, `PRODUCT.md`. Tokens: `css/tokens.css` (v2).
- CSS: `lumitea.css` (global/landing) → `app.css` (telas internas) → `css/tokens.css` → `css/enhance.css` (carrega
  por ÚLTIMO; é a camada de polish/motion, já gated por calmo/reduced-motion).
- Skill do Claude: **`lumitea-design-system`** trava tokens + paleta/mascote. Use-a ao criar/editar UI.
- Ícones: SVG via `js/core/icons.js` — `<i class="lt-i" data-lt-icon="nome">` (estático) ou `LUMI.icon(n)`/
  `LUMI.hydrateIcons(el)` (dinâmico). NUNCA usar emoji como ícone funcional.

## Helpers criados (REUSAR, não reinventar)
- `js/core/reveal.js` — reveal on scroll via classe `.lt-reveal` (IntersectionObserver, gated, com fallback).
  Já usado nas duas homes; pode plugar em qualquer página interna (incluir o script + pôr `.lt-reveal` nos blocos).
- `js/core/ui.js` → **`LumiUI`**: `toast(msg,{type})`, `alert(msg,{...})`→Promise, `confirm(msg,{...})`→Promise<bool>.
  Acessível (foco, Esc, ARIA, gated). **Usar no lugar de `alert()/confirm()` nativos** (abruptos demais p/ TEA).
- Escape de HTML: **`window.LUMITEA.esc()` / `.escBr()`** (em `js/core/config.js`). SEMPRE escapar dado de
  usuário/IA/teen antes de injetar via `innerHTML`.

## 🎮 Jogos do Theo (`games.html` = hub + 4 páginas)
Substituiu o antigo "Mundo Gelado do Theo" (mundo aberto em canvas), **removido do projeto em 2026-08-04**.
- `games.html` (hub) → `jogo-memoria.html`, `jogo-classificar.html`, `jogo-encaixe.html`, `jogo-imagem-palavra.html`.
- Estilo comum: `css/jogos.css` (prefixo `.jg-`). Motor comum: **`js/jogos/base.js`** (`window.LUMIJOGOS`):
  `boot()`, `pronto()`, `prefs(jogoId)`, `montarAjustes()`, `arrastar()`, `salvarSessao()`, `ganharXP()`, `som`, `embaralhar()`.
- **XP/nível dos jogos (implementado 2026-08-05):** cada `finalizar()` chama `J.ganharXP(pontuacao)` (pontuação
  já existente = acertos × 10). Grava em `neurodivergente.xp`/`.nivel` — **mesma tabela e mesmos limiares**
  (`[0,100,250,450,700,1000,1400,1900,2500,3200,4000]`) que `app-teen.js`/`home-autista.html` já usavam pro chat,
  então o XP dos jogos aparece sozinho na barra de XP da home teen. Não criar uma segunda fonte de XP.
  ⚠️ Existe um `js/gamificacao.js` com um sistema de conquistas/missões **separado, só em localStorage,
  não incluído em nenhuma página** (órfão — não confundir com o sistema de XP real, que é o da `neurodivergente`).
- **`js/jogos/sprites.js`**: 40 figuras SVG desenhadas em código (5 temas × 8) + 7 formas geométricas, com o
  nome em pt-BR de cada uma. **Não há assets de imagem novos** — nada a baixar, nada que quebre offline.
- **`arrastar()` aceita 4 caminhos**: mouse, dedo, toque-em-duas-etapas e teclado. Tolerância de encaixe
  ampliada de propósito (28–40px). Nunca reduzir: motricidade fina varia muito no público.
- **Som DESLIGADO por padrão** (`localStorage['lt-jogos-som']`), tom suave via WebAudio + narração via
  `speechSynthesis` (pt-BR, offline, sem custo — não usa o proxy ElevenLabs). O **modo calmo silencia tudo**.
- Regras que NÃO podem ser revertidas: sem cronômetro visível, sem pontuação negativa, **erro é silencioso**
  (sem som, sem vermelho, sem mensagem — a peça só volta), reiniciar sempre à mão, dificuldade só sobe se o
  usuário pedir. Partidas vão para `sessoes_jogo` com `jogo_id` = `memoria`/`classificar`/`encaixe`/`imagem-palavra`.
- `roleplay.html` e `rpg-social.html` continuam como redirects para `games.html`.

## 🔗 Vínculo cuidador↔teen e Calendário compartilhado
- **Vínculo**: vive em `neurodivergente.codigo_vinculo` (gerado no signup) + `.id_responsavel` (NULL = sem
  cuidador). Não há coluna de status — o estado é 100% inferido dessas duas colunas. RPCs SECURITY DEFINER:
  `aceitar_vinculo(p_codigo)` (só chamável por profile `tipo` = `responsavel`/`terapeuta`) e
  **`suspender_vinculo(p_teen_id)` (nova, 2026-08-05)** — só quem já é o `id_responsavel` daquele teen pode
  chamar; zera `id_responsavel` **e gera um `codigo_vinculo` novo** (o antigo fica inválido — pra reconectar,
  o teen compartilha o código novo, não reusa o velho). Botão "Encerrar vínculo" em cada card da aba
  "Vínculos" de `home-cuidador.html`. O teen é avisado com um `LumiUI.toast` acolhedor na próxima vez que
  abrir `home-autista.html` ou `conta.html` — detectado por diff local (`localStorage['lt-tinha-cuidador']`,
  mesma chave nas duas páginas), já que a tabela não guarda um evento/status pra ler direto. **Esse aviso NÃO
  usa a tabela `alertas`** (ver bug conhecido no Backlog) — de propósito, porque hoje nenhuma página do teen
  lê `alertas` (só o cuidador lê, pra crise/relatório).
- **Calendário**: já era compartilhado desde antes de hoje — uma única tabela `eventos_calendario`, RLS já
  permitia o cuidador ler/inserir/editar/apagar eventos dos teens vinculados a ele (`origem`/`id_cuidador`).
  Teen: `calendario.html`. Cuidador: `calendario-cuidador.html` — **hoje foi linkado no painel principal**
  (`home-cuidador.html`: nav do topo, menu mobile e sidebar); antes só dava pra chegar lá via
  `conta-cuidador.html` ou URL direta, então na prática era quase invisível. Colunas extras da migration
  (`categoria`, `lembrete_pre_minutos`, `checkin_pre/pos`, `contexto_roleplay`, `personagens`) **confirmadas
  aplicadas em produção** em 2026-08-05 (checado via Management API, não só nos `.sql` do repo).
  XSS corrigido (2026-08-05): título/descrição de evento eram injetados sem escapar em `innerHTML` nos dois
  lados (teen e cuidador) — corrigido com `window.LUMITEA.esc()` em `calendario.html` e um `esc()` local em
  `calendario-cuidador.html` (essa página não carrega `config.js`).

## 🔐 Segurança (estado atual e regras)
- **Chaves de IA/voz são gated por origem** (`js/core/config.js` + `js/core/secrets.js`): só carregam em DEV
  (localhost / `file://` / IP privado). Em domínio público ficam vazias → IA/voz passam pelos **proxies**.
  Provado por simulação: prod = chave vazia e `window.LUMITEA_SECRETS` indefinido.
- **`secrets.js` é gitignored** e só deve existir na máquina local. NUNCA versionar/publicar. NUNCA pôr
  `service_role` no cliente. Nunca colar chave no editor web do GitHub (foi assim que o secret scanning
  disparou em 2026-08-03).
- **Hook `pre-commit`** (`tools/git-hooks/pre-commit`) barra commit com padrão de chave (`gsk_`, `sk_`, `sk-`,
  JWT `eyJhbGciOi…`) ou com arquivo `secrets.js`/`.env`. Hooks não são versionados: cada pessoa roda
  `powershell -ExecutionPolicy Bypass -File tools/instalar-hooks.ps1` uma vez por clone.
- **Histórico do git purgado em 2026-08-03**: `js/core/secrets.js` (com a Groq `gsk_KRomykdn…` e a ElevenLabs
  `sk_ce3e755a…`) foi removido de todos os commits via `git filter-branch --index-filter`. Os SHAs mudaram —
  quem tiver clone antigo precisa re-clonar, nunca dar merge do clone velho.
- **Edge Functions** (`supabase/functions/groq-proxy`, `eleven-proxy`): **`groq-proxy` está deployado e ACTIVE
  desde 2026-08-05** (secret `GROQ_API_KEY` configurado no servidor, chave rotacionada — a antiga `gsk_KRomykdn…`
  não é mais usada). `eleven-proxy` **ainda não foi deployado** (sem chave nova da ElevenLabs). Ver
  "Deploy/admin da Supabase sem CLI" acima pro método (Management API, sem precisar de CLI). Secrets do servidor:
  `GROQ_API_KEY` (✅ setado), `ELEVENLABS_API_KEY` (pendente) (+ `ELEVEN_VOICE_ID`/`ALLOW_ORIGIN` opcionais).
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` são auto-injetadas.
- **PENDENTE do usuário:** (1) confirmar que revogou na Groq a chave antiga `gsk_KRomykdn…` (vazada, já trocada
  pela nova em uso) e revogar na ElevenLabs a `sk_ce3e755a…` se ainda ativa; (2) deployar o `eleven-proxy` quando
  tiver uma chave nova da ElevenLabs (mesmo método do `groq-proxy`); (3) commitar o `.gitignore` (o repo público
  estava sem ele).
- **RLS:** sólida (sem `using(true)`, políticas self-scoped `= auth.uid()`). Dados de saúde mental de menores =
  risco LGPD alto: qualquer mudança em SQL/RLS/Auth deve passar pela skill `supabase-security`.
- Risco conhecido NÃO corrigido: `email_por_telefone`/`telefone_existe` são `GRANT ... TO anon` (login por
  telefone) → enumeração de PII. Mitigar exige repensar o fluxo de login; não mexer sem combinar.

## Já corrigido (não refazer)
- Bug crítico `NIVEL_EMOJIS` na `home-autista.html` (quebrava XP + vínculo) → `NIVEL_ICONES` + try/catch.
- XSS no painel do cuidador (`home-cuidador.html`) → `LUMITEA.esc()` em todo innerHTML de dado do teen.
- Polish de acessibilidade da home teen (progressbar ARIA, burger aria-expanded, avatar, modal acolhedor no humor
  difícil em vez de `confirm()`), cores inline dos feature-link → token.
- Animações sutis e gated nas duas homes (reveal + hover + float só no mascote livre da teen).
- 4 `alert()` do cuidador → `LumiUI.toast`.
- XP/nível dos 4 jogos do Theo implementado e persistido em `neurodivergente.xp`/`.nivel` (2026-08-05) — ver seção de Jogos.
- Deploy do `groq-proxy` (Edge Function) via Management API, sem CLI (2026-08-05) — IA volta a funcionar em produção.
- Vínculo cuidador↔teen: RPC `suspender_vinculo` + botão "Encerrar vínculo" no painel do cuidador + aviso
  acolhedor ao teen (2026-08-05) — ver seção "Vínculo cuidador↔teen e Calendário compartilhado".
- Calendário do cuidador: link adicionado ao painel principal (estava órfão) + XSS de título/descrição de
  evento corrigido nos dois lados (`calendario.html` e `calendario-cuidador.html`) (2026-08-05).

## 📋 Backlog (próximos passos, sem quebrar nada)
1. Migrar os ~27 `alert/confirm` nativos restantes (conta, diário, calendário, conversa) para `LumiUI`.
   Atenção: `confirm()` síncrono → `LumiUI.confirm()` é Promise; ajustar para `await`/`.then`.
2. Conferir/padronizar escape em `chat.js`, `apoio.js` (provável OK).
3. Avaliar mitigação da enumeração de PII (item de Segurança) — só com aval do usuário.
4. **Bug pré-existente, não corrigido hoje (fora de escopo):** todo insert em `alertas` no código usa a
   coluna `desc`, mas a tabela só tem `descricao` — o insert falha inteiro (coluna inexistente), não só o
   campo. Afeta `js/cuidador.js` (`salvarAlertaSupabase`), o alerta de crise em `home-cuidador.html`
   (~L666/755, que também *lê* `a.desc` em vez de `a.descricao` em `carregarAlertas`) e o insert de "novo
   evento" em `calendario-cuidador.html`. Consertar leitura E escrita juntas se for mexer no sistema de
   alertas/crise (grep `\.desc\b` perto de `alertas`).
5. `conta.html` (teen) tem um campo "Ou informe o código que seu cuidador te passou" que só funciona pra
   contas com `profiles.tipo='terapeuta'` — pra `neurodivergente` (o público normal dessa página), a RPC
   `aceitar_vinculo` sempre retorna `tipo_invalido` (vira "Erro ao vincular." genérico na tela). Não afeta o
   fluxo real (o teen só precisa compartilhar o próprio código, nunca digitar um), mas confunde se alguém
   clicar. `js/app-teen.js` tem a mesma lógica quebrada, porém o arquivo inteiro está órfão — não é
   carregado por nenhuma página, zero efeito em produção.

## Subagents/skills úteis
`frontend-reviewer`, `accessibility-auditor`, `supabase-security-reviewer` (só rodar se o usuário pedir).
MCP `playwright` disponível, mas as páginas internas exigem sessão Supabase real (redirecionam p/ login sem auth) —
verificação aqui é majoritariamente estática. **`node --check`/parse com `vm` exigem Node, que não está instalado
nesta máquina** (ver seção Stack) — na falta dele, revisar a sintaxe lendo o trecho editado com atenção.

## Convenções de trabalho
- Validar JS com `node --check` **se o Node estiver disponível na máquina** (conferir antes de assumir — nem
  sempre está, ver Stack); senão, revisão manual cuidadosa do trecho editado. Conferir balanceamento de chaves do CSS.
- Português brasileiro em UI e mensagens.
- Confirmar antes de ações destrutivas/irreversíveis ou que afetem produção (deploy, rotação, login, SQL).
- PAT/chaves de API que o usuário colar no chat: usar só para a tarefa pedida, nunca persistir em arquivo do
  repo (nem em CLAUDE.md), e sugerir revogar o PAT depois de usado.
