# CLAUDE.md — LumiTEA

Contexto e regras para o Claude continuar o trabalho neste projeto. Leia antes de editar qualquer coisa.

## O que é
App web de apoio socioemocional para **adolescentes autistas (TEA)** e **pais/cuidadores**.
Duas áreas: **teen (calma)** e **cuidador (sóbria)**. Mascote: urso **Lumi/Theo**.

- Raiz do app: `C:\Users\196402024\LumiTea\` (repo git na mesma pasta).
- Roda **sem servidor** (caminhos relativos). Local: `serve.ps1` / `rodar-local.bat` (= localhost).
- **Node agora está instalado** (`node v24.16.0`, `npm 11.13.0` — confirmado em 2026-08-05, visível tanto no
  Bash tool quanto no PowerShell via `C:\Program Files\nodejs\node.exe`). A nota anterior dizendo que não havia
  Node/npx/npm nesta máquina estava desatualizada — **usar `node --check` pra validar JS sempre que possível**
  (extrair os blocos `<script>` dos `.html` pra um `.js` temporário no diretório de scratchpad e rodar o check
  neles, já que os arquivos são HTML, não JS puro). Ainda não instalado: `supabase.exe` (CLI da Supabase) — pra
  deploy/admin, seguir "Deploy/admin da Supabase sem CLI" abaixo. Ferramentas disponíveis: PowerShell (com
  `ConvertFrom-Json`/`ConvertTo-Json` nativos), `curl` (mingw64, via Bash tool) e agora Node/npm.

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

## 🎮 Jogos do Theo (`games.html` = hub + 5 páginas)
Substituiu o antigo "Mundo Gelado do Theo" (mundo aberto em canvas), **removido do projeto em 2026-08-04**.
- `games.html` (hub) → `jogo-memoria.html`, `jogo-classificar.html`, `jogo-encaixe.html`, `jogo-imagem-palavra.html`
  e **`lousa-pintar.html`** (ver seção própria abaixo).
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

## 🖥️ Painel do cuidador = 13 páginas .html + uma casca comum (2026-08-07)
Antes, quase tudo do painel eram **abas escondidas** dentro de `home-cuidador.html` (`<div class="cui-tela">`
trocadas por `irTela()`). Um erro de JS em qualquer ponto daquele arquivo de 875 linhas derrubava **todas** as
abas juntas — era essa a causa de "as páginas não abrem". O sistema de abas **foi removido**; cada área virou
uma página de verdade. **Não recriar abas.**
- Páginas: `home-cuidador.html` (só o painel geral), `alertas-`, `live-`, `humor-`, `relatorios-`,
  `observacoes-`, `progresso-`, `estatisticas-`, `consultoria-` (chat com a Lumi), `vinculos-`,
  `calendario-`, `comunidade-`, `conta-cuidador.html`.
- **`js/core/cuidador-shell.js` (`window.CUI`)** é a casca comum: injeta topo mobile, gaveta, faixa de alerta
  urgente, **sidebar (menu num lugar só — a const `MENU` no topo do arquivo)** e a barra "Adolescente:".
  Também faz sessão + guarda de tipo de conta, `window.sairCui()`, e os helpers `esc/ic/vazio/cuiStat/
  humorChip/humorTexto/calcMediaHumor/renderHumorBars/alertaIcone/NIVEL_XP/definirNome`.
- **A página declara no `<body>`:** `data-cui-pagina="<id do MENU>"` (item ativo), `data-cui-teen="1"`
  (injeta a barra do adolescente) e `data-cui-shell="nav"` (só desenha a casca; a página cuida da própria
  sessão — usado em `comunidade-`, `calendario-`, `conta-cuidador.html`).
- **A página carrega dados assim:** `CUI.aoTrocarTeen(function (teenId) { ... })`. Roda quando a casca fica
  pronta e a cada troca no seletor. `teenId` pode vir `null` (sem vínculo) — sempre tratar esse caso.
- ⚠️ **`cuidador-shell.js` NÃO pode ter `defer`** e tem que vir logo depois do `config.js`. O `<script>` no fim
  do body das páginas roda durante o parse e já usa `CUI`; com `defer` a casca só existiria depois → 
  `CUI is not defined`. (Foi um bug real, pego no teste com jsdom.)
- **Adolescente selecionado é lembrado entre páginas** em `localStorage['lt-cui-teen']`. Se o id salvo não
  existe mais (vínculo encerrado), cai no primeiro da lista em vez de mostrar tela vazia.
- `home-cuidador.html?tela=<x>` (links antigos/favoritos) **redireciona** para a página nova — mapa no 1º
  `<script>` do `<head>`. Mantenha o mapa se renomear alguma página.
- ⚠️ **Nunca escrever `<script>` (nem `<\/script>`) dentro de string JS ou de comentário HTML.** O `baixarPDF`
  de `relatorios-cuidador.html` usava um `document.write()` de 1500+ caracteres com uma tag `<script>` escapada
  dentro; o navegador quebrava com `Uncaught SyntaxError: Invalid or unexpected token` e **derrubava o arquivo
  inteiro** (Node e parse5 aceitavam — só o navegador reclamava, então o teste com jsdom NÃO pega isso).
  Reescrito com `createElement`/`appendChild` + `win.print()` chamado pela própria página. Se precisar montar
  outra janela/documento, usar o mesmo padrão — nada de `document.write`.
- **Botões de ação principal nunca nascem `hidden` esperando o carregamento dar certo.** Em `relatorios-` o
  "Gerar relatório" ficava escondido até a lista carregar; qualquer falha no caminho deixava o cuidador sem
  saída. Agora ele é sempre visível e só fica `disabled` sem adolescente escolhido (+ atalho no estado vazio).
- Estilos: nenhum `style=""` novo. As peças que vinham inline viraram classes em `app.css`
  (`.cui-hint`, `.cui-tela-topo`, `.cui-live-hd`, `.humor-linha`, `.cui-teen-*`, `.prog-xp--espaco`, etc.),
  e existe agora um `[hidden]{display:none!important}` global (sem ele, `hidden` não vence `.btn-primary`,
  que declara `display:inline-flex`).
- **Como testar sem login:** as páginas exigem sessão Supabase real, então a verificação é feita com **jsdom**
  (`npm i jsdom@24` num diretório temporário; jsdom novo exige Node > 20 e aqui o Node é v20.15.1) + um
  cliente Supabase falso com latência simulada. Confere: menu com 13 itens, item ativo, ícones hidratados,
  seletor preenchido, conteúdo renderizado e zero erro de console. Foi assim que os 2 bugs de ordem/corrida
  apareceram.
- `js/cuidador.js` e `js/lumi-ia.js` **não são mais carregados** por `home-cuidador.html` (o painel usa
  `LUMITEA.groqFetch`). `js/cuidador.js` ficou órfão — `lumi-ia.js` ainda é usado pelas páginas do teen.

## 🎨 Lousa de pintar (`lousa-pintar.html`, 2026-08-11)
5º item do hub, mas **não é uma partida**: folha em branco, sem objetivo, sem placar, sem progresso e sem
fim de rodada. Não existe estado de erro porque não há como fazer errado — não reintroduzir nenhum.
- Motor em `js/jogos/lousa.js`; reusa `js/jogos/base.js` (sessão/nav/som/XP/`salvarSessao`) como os outros.
- Tema `.jg-tema-lousa` (rosa) + classes `.lo-*` em `css/jogos.css`. Tokens novos: `--rosa-dark`, `--tint-rose`.
- **`--lo-papel` (branco quente, `#fffdf9`) mora no CSS e o JS LÊ o valor** por `getComputedStyle`: a borracha
  pinta com ele e o PNG exportado nasce com ele. Mudar num lugar só quebra o outro.
- **Três caminhos para desenhar** (motricidade varia, mesma regra do `arrastar()`): ponteiro/dedo, mouse e
  **teclado** (setas movem, espaço encosta/levanta). O canvas é `role="application"` + `tabindex="0"` para as
  setas chegarem nele. `pointermove`/`pointerup` ficam no **document**, não no canvas: sair da folha no meio
  do traço e voltar não corta o traço, e soltar o dedo fora não deixa o traço preso.
- **Nada vai para o servidor além de `sessoes_jogo` + XP.** "Guardar desenho" baixa o PNG em tamanho cheio e
  guarda uma **miniatura de 560px** em `localStorage['lt-lousa-galeria']` (máx. 8; `guardarNaGaleria` trata
  `QuotaExceededError` sacrificando o mais antigo e tentando de novo). Ao ler a galeria, só entra no `src`
  string que começa com `data:image/`.
- XP: 20 por desenho guardado, **teto de 3 por dia** (`localStorage['lt-lousa-xp']`), pela mesma
  `J.ganharXP` dos outros jogos — não criar segunda fonte de XP. `jogo_id` = `lousa` (a coluna é TEXT puro,
  sem CHECK — conferido em `db/LUMITEA_SCHEMA.sql`).
- ⚠️ **`lumitea.css` dá `padding: 72px 56px` + `max-width: 1100px` a TODO `<section>` sem classe própria**
  (regra da landing, linha ~422). Qualquer `<section>` novo numa tela interna nasce com um buraco de 72px em
  cima e desalinhado das outras caixas. As seções da lousa zeram isso explicitamente; os outros jogos
  escapavam por acaso, porque `.jg-palco`/`.jg-ajustes`/`.jg-fim` já declaram o próprio `padding`.

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

## 📝 Relatórios da IA: o JSON da Lumi nunca vai direto pro banco (2026-08-10)
`relatorios-cuidador.html` gerava o relatório, mandava `insert(rel)` com o objeto **cru** que a IA devolveu e
tomava **HTTP 400**. Duas causas, as duas no JSON da IA:
1. **Chave que não é coluna** → PostgREST responde `400/PGRST204` ("Could not find the 'x' column of
   'relatorios' in the schema cache"). A Lumi inventa campo extra com frequência.
2. **`humor_geral` fora do CHECK** → `400/23514`. A coluna só aceita
   `'muito-bem'|'bem'|'neutro'|'mal'|'muito-mal'`, e a IA escreve "triste", "misto", "difícil", "bom"…
O bug é **antigo**: a versão anterior (dentro de `home-cuidador.html`, commit `ffb1292`) fazia
`await sb.from('relatorios').insert(rel)` **sem checar `error`** — falhava calada e a tela dizia sucesso.
Só apareceu quando `relatorios-cuidador.html` passou a checar o `error`.
- **Correção:** `montarPayload(rel, teenId)` monta o objeto campo a campo (whitelist por construção) e
  normaliza tipos; `normalizarHumor()` traduz o vocabulário da IA (sem acento, `_`/espaço → `-`, + tabela de
  sinônimos) pro do banco, caindo em `'neutro'` no desconhecido. `listaDeFrases()`/`listaDeDicas()` aceitam
  string onde era lista e objeto onde era frase. **Qualquer código novo que grave em `relatorios` deve passar
  por esse mesmo caminho — nunca `insert` do JSON cru da IA.**
- **De quebra:** o badge de humor mostrava **sempre "Neutro" e sem cor**. O banco guarda
  `muito-bem/bem/neutro/mal/muito-mal`, mas as classes de `app.css` são `humor-otimo/bom/neutro/dificil/crise`
  — só `neutro` coincidia. Agora existe o mapa `HUMOR_UI` (banco → classe + rótulo), e o render passa pelo
  `normalizarHumor()` antes, então linha antiga gravada no vocabulário errado também aparece certa.
- O `console.error` do insert agora loga `code | message | details | hint | payload` separados (o objeto de
  erro do PostgREST aparece colapsado no console e escondia justamente o que interessava).
- **Como conferir schema de produção sem PAT:** o PostgREST valida a *schema cache* **antes** da RLS. Um
  `POST /rest/v1/<tabela>` com a **anon key** e `{"coluna":null}` devolve `PGRST204` se a coluna não existe e
  `42501` (RLS) se existe — nada é gravado. Foi assim que as 11 colunas de `relatorios` foram confirmadas em
  produção nesta investigação. Cuidado: **CHECK constraint roda DEPOIS da RLS**, então esse truque não valida
  valor, só nome de coluna.
- ⚠️ `js/cuidador.js` tem um `salvarRelatorioSupabase()` com o mesmo defeito (`Object.assign` do objeto cru),
  mas o arquivo está **órfão** (nenhum `.html` o carrega) — sem efeito em produção. Se algum dia voltar a ser
  usado, corrigir junto.

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
- **Bug raiz do calendário cuidador↔teen não conectar (2026-08-05):** `calendario-cuidador.html` inserindo
  evento gravava `origem: 'cuidador'`, mas a coluna `origem` de `eventos_calendario` tem
  `CHECK (origem IN ('adolescente','responsavel','terapeuta'))` — `'cuidador'` não está na lista, então **todo
  insert do cuidador falhava** (confirmado direto em produção via Management API: 0 eventos com essa origem
  existiam no banco). Como o código não checava `error` da resposta, a tela mostrava "Evento adicionado com
  sucesso!" mesmo o evento nunca sendo salvo. Corrigido: `origem` agora grava `'responsavel'` (já usado em
  `perfil.tipo` em todo o resto do app) em `calendario-cuidador.html`, e todas as comparações
  `ev.origem==='cuidador'` nos dois arquivos (`calendario.html` e `calendario-cuidador.html`) viraram
  `==='responsavel'`. Insert agora checa `error` e avisa o usuário se falhar, em vez de sucesso falso. De
  passagem, também corrigido o mesmo bug de coluna `desc`→`descricao` (ver item 4 do Backlog) no insert de
  aviso pro teen dentro de `adicionarEventoCuidador()` — só esse call site, os outros 2 do backlog continuam
  pendentes. RLS/schema de `eventos_calendario`, `relatorios`, `alertas` e `neurodivergente` foram conferidos
  em produção nessa investigação e estão OK (não eram a causa). `calendario-cuidador.html` **já existia** como
  página separada do calendário do cuidador desde antes (criada mais cedo no mesmo dia) — não foi recriada.
- **Insert de relatório falhando com 400 + badge de humor sempre "Neutro" (2026-08-10)** — ver a seção
  "Relatórios da IA: o JSON da Lumi nunca vai direto pro banco".

## 📋 Backlog (próximos passos, sem quebrar nada)
1. Migrar os ~27 `alert/confirm` nativos restantes (conta, diário, calendário, conversa) para `LumiUI`.
   Atenção: `confirm()` síncrono → `LumiUI.confirm()` é Promise; ajustar para `await`/`.then`.
2. Conferir/padronizar escape em `chat.js`, `apoio.js` (provável OK).
3. Avaliar mitigação da enumeração de PII (item de Segurança) — só com aval do usuário.
4. ~~Bug da coluna `desc` vs `descricao` na tabela `alertas`.~~ **RESOLVIDO em 2026-08-07**: os 3 call sites
   foram corrigidos (`calendario-cuidador.html` em 06/08; o alerta de crise saiu de `home-cuidador.html` e
   foi para `relatorios-cuidador.html` já gravando `descricao`; `js/cuidador.js` também). A leitura agora usa
   `a.descricao` em `alertas-cuidador.html`. Não há mais `\.desc\b` perto de `alertas` no projeto.
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
