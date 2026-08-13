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

## 🛬 Landing pública (`index.html`) — redesign "Landing-A produto" (2026-08-13)
Importada do projeto Claude Design **LumiTEA-TCC redesign** (`43c671f9-f91d-43d2-beaa-1b560669d04b`,
arquivo `Landing-A-produto.dc.html`) via MCP `claude_design`. O `.dc.html` é 100% estilo inline +
atributos `style-hover` (convenção do design canvas) — **foi traduzido para classes + tokens**, não copiado.
- **`index.html` NÃO carrega mais `lumitea.css`** (é a única página do projeto assim). O design substitui
  toda a landing antiga, e a regra global `section { padding:72px 56px; max-width:1100px }` da `lumitea.css`
  desalinharia as faixas de largura total. Ordem: `css/tokens.css` → **`css/landing.css`** → `css/enhance.css`.
  As classes velhas da landing (`.hero`, `.features-grid`, `.divider`, `.cta-bg`, `.preview-*`, `.app-section`,
  `footer.lumi-footer`) continuam na `lumitea.css` como código morto — **não removi**, porque outras 28 páginas
  carregam esse arquivo e a checagem de quem usa o quê não foi feita.
- **`css/landing.css`**, prefixo `.lp-`, zero `style=""` no HTML. Tons de apoio que não são token global
  (`--lp-navy-1/2`, `--lp-sky-ink`, `--lp-chat-1/2`, `--lp-white-soft`, `--lp-blue-mist`, `--lp-cream-2`,
  `--lp-verde-ink`, `--lp-video-bg`) vivem num `:root` no topo da folha. Paleta e mascote intactos.
- **`js/landing.js`** só faz o menu mobile (o design veio sem responsivo; os breakpoints são adaptação minha).
  Reveal e float vêm de `js/core/reveal.js` + `css/enhance.css` (`.lt-reveal`, `.lumi-float`, `.badge-dot`),
  já gated por modo calmo/reduced-motion — **não duplicar observer na página** (a versão antiga tinha DOIS
  IntersectionObserver inline fazendo a mesma coisa).
- Ícones via `js/core/icons.js` (`data-lt-icon`) — o design usava o mesmo set Feather, os paths batiam. Foi
  adicionado **`arrow-right`** ao `icons.js` (era o único que faltava).
- ⚠️ **Duas armadilhas reais, pegas no render, não na leitura do código:**
  1. `.lp-body a { color: … }` é (0,1,1) e **vencia** `.lp-btn--cta { color:#fff }`, que é (0,1,0) → texto azul
     em botão azul, ilegível. Corrigido com `:where(.lp-body) a`, que zera o peso da classe (0,0,1).
  2. `grid-template-columns: repeat(auto-fit, minmax(420px,1fr))` no hero: com `auto-fit` a coluna colapsa
     para 1, **mas o mínimo de 420px continua valendo** e estourava a tela no celular (texto cortado à
     direita, escondido pelo `overflow-x:hidden` do body). Corrigido com `minmax(min(420px,100%),1fr)`.
- **Não pôr `overflow:hidden` em `.lp-topo`** para conter os blobs: ele é o ancestral do `.lp-nav`, que é
  `position:sticky` — overflow em ancestral quebra sticky. O `overflow-x:hidden` do body já clipa (os blobs
  vazam de propósito).
- Decisões de conteúdo confirmadas com o usuário: "Abrir o chat" aponta pra `cadastro.html` (não
  `entrada-conv.html`, que exige sessão e jogaria o visitante no login) e a seção "O App" antiga foi removida
  junto com a promessa de **"Funciona offline"**, que não é verdade (o app depende do Supabase).
- Como conferir visualmente: ver a memória `render-visual-com-chrome-headless` — Chrome headless para desktop
  e **iframe de 390px** para mobile (no Windows o headless tem viewport mínimo de ~504px e só recorta a foto,
  o que finge ser overflow). O reveal on scroll não dispara a tempo em screenshot com âncora: seções abaixo da
  dobra saem em branco — **artefato da ferramenta**, confirme com uma janela alta (ex. 1440×4400) antes de
  sair "corrigindo" um bug que não existe.

## 📊 Painel geral do cuidador — redesign "Cuidador-A-painel" (2026-08-13)
Importado do projeto Claude Design **LumiTEA-TCC redesign** (mesmo `43c671f9-…` da landing, arquivo
`Cuidador-A-painel.dc.html`) via a ferramenta **DesignSync** (`list_files`/`get_file` com o `projectId`).
O `.dc.html` é 100% estilo inline + `style-hover` — **traduzido para classes + tokens**, não copiado.
- **Sidebar virou azul-marinho e isso vale para as 13 páginas** (decisão do usuário): o CSS mora em
  `.cui-sidebar` & cia. em `app.css`, e a marcação continua vindo da `cuidador-shell.js`. A textura de
  pontinhos é `background-image` na PRÓPRIA sidebar, e **não** um filho `position:absolute` como no design —
  a sidebar é `overflow-y:auto` e um filho absoluto só cobriria a altura visível. Os brancos translúcidos do
  design foram subidos pra passar WCAG AA sobre o navy (`.45`→`.66` nos rótulos de seção, `.6`→`.72` no
  "Sair"), e o `:focus-visible` ganhou anel claro (o `--focus-ring` padrão é azul escuro, some no navy).
- **`home-cuidador.html` foi reescrita** com prefixo `.pn-` (só ela usa). O bloco de boas-vindas com o urso
  saiu (o design não tem; o urso segue no topo da sidebar). Conteúdo: 5 cartões de número, gráfico de linha
  de humor, "Registros de hoje", Alertas, Último relatório e Próximos na rotina.
- **A barra do adolescente ganhou um contrato novo:** a casca expõe `CUI.definirStatus(txt)` (troca o
  "Monitorando") e `CUI.idade(nascimento)`; o `#teen-humor-current` **saiu de `.cui-teen-bar-fim`** pro grupo
  da esquerda, e o seletor agora mostra "Nome · N anos" (`neurodivergente.nascimento`, coluna que
  `conta.html` já usa em produção). A página injeta os próprios controles (período 7/14/30, Exportar) em
  `.cui-teen-bar-fim` no `DOMContentLoaded` — a casca registra o listener dela antes, então a barra já existe.
- **O que é dado real e o que não é** (combinado com o usuário, está comentado no topo do `<script>`):
  - `conversas` **não aparece no painel**: a RLS só tem `conv_self`, o cuidador não lê nem a contagem. A
    linha "Conversa com o Theo · N mensagens" do design foi deliberadamente omitida. Se um dia entrar, tem
    que ser RPC devolvendo só o número.
  - "XP em jogos (7d)" = soma de `sessoes_jogo.pontuacao`. **Subestima** (o XP do chat não é registrado em
    lugar nenhum); some quando é zero.
  - "Rotina cumprida" = eventos dos últimos 7 dias com check-in pós respondido em `lembretes_evento`
    (`acao_tomada` ≠ `'dispensou'`). Não existe coluna de "concluído"; some quando não houve evento.
  - "Exportar" baixa CSV dos humores do período (`;` + BOM, que é o que o Excel pt-BR abre limpo).
- **O "falta X XP pro nível N" procura o limiar pelo XP, não indexando `CUI.NIVEL_XP` por
  `neurodivergente.nivel`.** As duas colunas podem discordar (o `nivel` só é reescrito quando o teen ganha
  XP), e indexando pelo nivel a tela dizia "nível máximo" com 1240 XP em nivel 4. Pego no teste.
- ⚠️ **Texto de eixo dentro de `<svg>` encolhe junto com a coluna.** Os `<text>` do design saíam com ~7px no
  desktop e ~5px no celular. Os rótulos dos eixos viraram HTML (`.pn-chart-y` / `.pn-chart-x`) posicionados
  por % sobre o SVG — as porcentagens são as coordenadas do `viewBox` ("0 0 700 180"), mudar numa ponta
  exige mudar na outra. Só apareceu no render, não na leitura do código.
- ⚠️ Vale de novo a armadilha da lousa: `.pn-card` é `<section>` e **zera `padding`/`max-width`/`margin`**
  por causa da regra `section { padding:72px 56px; max-width:1100px }` da `lumitea.css`.
- ⚠️ **A `lumitea.css` também tem uma regra de elemento `nav { … }`** (linha ~105, a barra do topo da
  landing): `position:sticky; z-index:100; background:rgba(242,246,251,.9); backdrop-filter:blur(12px);
  border-bottom:1px solid; padding:14px 56px`. Ela pegava o `<nav class="cui-nav">` do menu do cuidador, que
  só sobrescrevia `display`/`gap` — então o menu vinha **com um painel quase opaco por cima e 56px de recuo
  lateral** (era isso que quebrava "Histórico de humor" e "Consultoria com o Lumi Theo" em três linhas). Era
  um bug **antigo**, invisível enquanto a sidebar era branca; só apareceu com o fundo navy. `.cui-nav` agora
  anula tudo isso explicitamente. **Todo elemento `nav`/`section` novo numa tela interna precisa da mesma
  checagem** — as barras `.app-nav` das telas do teen convivem bem com a regra, mas menu vertical não.
- Verificado com **jsdom** (48 asserções: casca, controles, cartões, gráfico sem NaN, XSS escapado, troca de
  período, exportar, estado vazio) + fumaça nas 13 páginas + Chrome headless em 1440/768/390 e medição de
  overflow horizontal (`scrollWidth` ≤ viewport em 360/390/768).

## 💥 A lição do `nascimento`: coluna faltando derruba o SELECT inteiro (2026-08-13)
`neurodivergente.nascimento` e `.apelido` estavam no `db/LUMITEA_SCHEMA.sql` mas **nunca tinham sido
migradas** pro banco real. **RESOLVIDO** (ver "o que foi feito" abaixo), mas a lição fica:
- **Uma coluna inexistente faz a consulta INTEIRA falhar**, não só aquele campo vir vazio. E como quase todo
  lugar do projeto faz `res.data || []` ou `nd?.campo ?? padrão`, o erro sumia e a tela mentia. Dois
  sintomas reais que vieram daí: o painel do cuidador dizendo **"nenhum adolescente vinculado"** com o
  vínculo intacto, e a `conta.html` do teen mostrando **XP 0, nível 1, código `------` e "sem cuidador"**
  com tudo cadastrado. **Antes de pôr coluna nova em qualquer `select`, provar que ela existe no banco**
  (truque do PGRST204 com a anon key — ver a seção de Relatórios; não precisa de PAT).
- **`supabase-js` NÃO lança exceção em erro do PostgREST**, devolve `{error}`. `try/catch` em volta de um
  `.update()` nunca dispara — era por isso que `salvarPerfil()` da `conta.html` mostrava "Salvo!" sem gravar
  nada. Sempre checar `.error` explicitamente.

**O que foi feito (migração aplicada em produção via Management API):**
1. `ALTER TABLE public.neurodivergente ADD COLUMN IF NOT EXISTS nascimento DATE, ADD COLUMN IF NOT EXISTS
   apelido TEXT;` + `NOTIFY pgrst, 'reload schema';`. Aditivo, anulável, sem default → só metadado, nenhuma
   linha reescrita. Conferido antes e depois: 7 linhas, 1 vínculo, tudo intacto.
2. **Backfill filtrado** de `nascimento` a partir de `auth.users.raw_user_meta_data` (é lá que o
   `js/cadastro.js` guarda a data no `signUp` — o cadastro nunca escreveu na tabela). 5 das 7 contas
   preenchidas; **2 ficaram NULL de propósito**, com anos de 6 dígitos (`275760-05-04`, `42132-03-02`)
   digitados antes de o campo ter limite.
3. Consultas passaram a **logar `res.error`**: `carregarTeens` (`cuidador-shell.js`) e o carregamento +
   o salvamento de perfil da `conta.html`.
4. **Campo de data ganhou limite** em `cadastro.html` e `conta.html`: `min="1900-01-01"` no HTML e `max` =
   hoje posto por JS (um `max` fixo envelhece). `!valor` sozinho **não bastava** para validar — ano de 6
   dígitos é uma data válida pro input e `.value` vinha preenchido; agora é preciso olhar
   `validity.badInput/rangeUnderflow/rangeOverflow` + regex `^\d{4}-\d{2}-\d{2}$`. Conferido no Chrome:
   corrompida/futura/antiga barradas, válida aceita.

⚠️ Só `nascimento`/`apelido` estavam faltando. Todo o resto conferido nessa investigação (`humores`,
`alertas`, `eventos_calendario`, `sessoes_jogo`, `lembretes_evento`, `relatorios`) bate com o `.sql`.
O banco também tem duas divergências inofensivas não tocadas: `neurodivergente.perfil` (coluna extra, fora
do `.sql`) e `nome_mascote` com default `'Lumi'` onde o `.sql` diz `'Theo'`.

## 👥 Comunidade — redesign "Comunidade-A" (2026-08-13)
Importado do mesmo projeto Claude Design (`Comunidade-A.dc.html`) via **DesignSync**. Vale para as DUAS
páginas (`comunidade.html` e `comunidade-cuidador.html`), que são espelhos com o mesmo contrato de DOM e os
mesmos módulos — por isso o restyle foi feito nos módulos compartilhados, não duplicado.
- **O design era quase todo restyle**: `SALAS_TEEN` em `js/chat.js` já tinha as 4 salas desenhadas, e
  posts/comentários/apoios/categoria já existiam no banco. Nada de schema novo foi preciso.
- **Salas viraram barra lateral** (`.ch-wrap` é grid 2 colunas): ícone + nome + **prévia da última
  mensagem** + badge de não-lidas. A prévia sai de UMA consulta (`carregarPrevias`) que pega as mensagens
  de hoje de todas as salas e usa a primeira de cada — mais barata que uma consulta por sala — e é
  atualizada ao vivo pelo mesmo handler de Realtime. Abaixo de 900px vira uma coluna com
  `.ch-side { display: contents }` pra poder ordenar salas → conversa → regras.
- **"N online agora" é presença REAL** (Supabase Realtime Presence no canal `chat:<publico>` que o chat já
  abria). `presence.key` = id do usuário, então duas abas contam como uma pessoa. Só o número é exposto,
  nunca nomes. `track()` só depois de `SUBSCRIBED` — antes disso é ignorado. Sem Realtime, o seletor nunca
  roda e o selo fica `hidden` em vez de mostrar número inventado.
- **`Chat` ganhou duas saídas**: `aoMudarNaoLidas(fn)` (badge da aba Conversas, que some quando a aba está
  aberta) e `aoMudarOnline(fn)` (o selo do hero).
- **Categorias viraram chips** no lugar do `<select>` (`#cm-categorias`; o `<select id="cm-categoria">` não
  existe mais). Segundo toque no mesmo chip desmarca — a categoria continua opcional. Contador de
  caracteres novo; `mostrarSugestao` chama `atualizarContador()` à mão porque atribuir `.value` por JS não
  dispara `input`.
- **Cards de post**: badge de categoria com cor por `slugCat()` (`.c-vitoria`, `.c-duvida`…) e prévia do
  comentário mais recente sempre visível. A prévia veio de graça: a consulta que já contava comentários
  passou a pedir as colunas do comentário.
- **"Conceitos que ajudam" e "Pergunta pro Lumi Theo" saíram da aba Apoio** pra lateral do Mural
  (`.cm-grid`). **Os ids não mudaram** (`#ap-conceitos`, `#ap-conversa`, `#ap-pergunta`, `#ap-enviar`), então
  `js/apoio.js` não precisou de uma linha. A aba Apoio ficou com Ferramentas (`js/aba.js`) + Dicas pra hoje.
- ⚠️ **Terceira regra de ELEMENTO da `lumitea.css` a vazar pra tela interna**, depois de `section` e `nav`:
  **`h1 { color: var(--text-main) }`** (linha ~257). Regra de elemento vence herança do pai
  independentemente de especificidade, então o `<h1>` do hero saía azul-escuro sobre o navy, ilegível —
  `.cap-hero h1` precisou declarar `color:#fff`. **Ao estilizar qualquer tag nua numa tela interna,
  declare a cor.** No mesmo render apareceu de novo o `section { padding:72px 56px; max-width:1100px }`
  batendo em `.cap-panel` (vão de 72px abaixo das abas + 112px de largura comidos) — bug **antigo**, só
  visível depois que o conteúdo passou a ter duas colunas.
- ⚠️ **`js/core/hero-bolhas.js` injeta a camada decorativa como um `<div>` filho do hero.** Uma regra
  `.cap-hero > div { position: relative }` na `enhance.css` (que carrega depois da `app.css`) tornava a
  camada um item de flex: ela comia ~420px e empurrava o título pro meio da faixa. Qualquer regra que mire
  filhos diretos de um `.lt-hero-bolhas` precisa de `:not(.hb-camada)`.
- Verificado com **jsdom** (48 asserções × 2 páginas: salas, prévias, presença, chips, contador, badges de
  categoria, prévia de comentário, XSS escapado, lateral do Mural, aba Apoio sem duplicata) + Chrome
  headless nas duas abas em 1440/820/390 + medição de overflow (`scrollWidth` ≤ viewport em 360/390/820).

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
- Landing pública redesenhada a partir do Claude Design (2026-08-13) — ver a seção "Landing pública".

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
