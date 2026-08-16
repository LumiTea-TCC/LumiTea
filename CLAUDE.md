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

## 🎮 Jogos do Theo (`games.html` = hub + 6 páginas)
Substituiu o antigo "Mundo Gelado do Theo" (mundo aberto em canvas), **removido do projeto em 2026-08-04**.
- `games.html` (hub) → `jogo-memoria.html`, `jogo-classificar.html`, `jogo-encaixe.html`, `jogo-imagem-palavra.html`,
  **`lousa-pintar.html`** e **`roleplay.html`** (as duas últimas têm seção própria abaixo).
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
  usuário pedir. Partidas vão para `sessoes_jogo` com `jogo_id` = `memoria`/`classificar`/`encaixe`/`imagem-palavra`/
  `lousa`/`roleplay`.
- `rpg-social.html` continua como redirect pra `games.html` ("A Jornada (RPG)", mundo aberto antigo — não confundir
  com o Roleplay atual, que é outro conceito). **`roleplay.html` NÃO é mais redirect** desde 2026-08-16 — ver seção
  própria abaixo.

## 🎭 Roleplay — encenação de conversas do dia a dia (`roleplay.html`, 2026-08-16)
6º item do hub. Importado do projeto Claude Design **`ce3cca9b-0386-4c5c-a63a-65f221777eff`**
(`Roleplay.dc.html`) via `claude_design`/DesignSync — igual à landing e ao painel do cuidador, o `.dc.html`
(100% estilo inline, motor de preview `sc-if`/`sc-for`/`DCLogic` em React) foi **traduzido** pra classes +
tokens + JS vanilla no padrão dos outros jogos, não copiado. `roleplay.html` **reaproveitou o arquivo que já
existia como stub de redirect** (mundo aberto antigo, removido em 2026-08-04) — não foi criado um nome novo.
- Escolha de cenário: 7 cards com o mesmo `.jg-grid`/`.jg-card` do hub (tema `.jg-tema-roleplay`: `--jg-cor`/
  `-ink`/`-bg` = `--primary`/`--primary-dark`/`--info-bg`, batem exatamente com os hex do design). Como o tema
  vive no `<main class="jg-wrap jg-tema-roleplay">` (não em cada card, diferente do hub), a faixa colorida do
  topo precisou de uma regra própria: `.jg-tema-roleplay .jg-card { border-top: 4px solid var(--jg-cor); }`
  logo abaixo da regra equivalente dos cards do hub em `css/jogos.css`.
- **Conduzida por IA (Groq), não roteirizada — mudou em 2026-08-16.** A primeira versão (mesmo dia, mais cedo)
  era 100% determinística: cada cenário tinha um roteiro fixo de 3 respostas + 3 dicas que ciclava em
  `estado.turno % length`. O usuário pediu conversa de verdade com a IA conduzindo o papel — agora cada
  cenário só define `personagem`/`objetivo`/`tag` (a "cena") e `montarPromptSistema(c)` monta um prompt de
  sistema instruindo a IA a **nunca sair do personagem**, responder curto (1–3 frases) e, a cada mensagem,
  avaliar se o adolescente **já demonstrou** a habilidade central da cena (não precisa resolver a situação
  toda, só demonstrar a habilidade). A IA responde **sempre em JSON**
  (`{"resposta":...,"dica":...,"concluido":true|false}`), parseado por `interpretarRespostaIA()` (tolera cerca
  de código ```` ```json ```` e tenta extrair `{...}` mesmo se vier texto solto em volta — modelos nem sempre
  obedecem "só JSON" à risca). Usa `window.LUMITEA.groqFetch` (mesmo proxy/chave de sempre) com o mesmo padrão
  de fallback de modelo do `diario.html` (`chamarGroq`: tenta `GROQ_MODEL`, se falhar tenta
  `llama-3.1-8b-instant`).
  - **Roteiro fixo de 2026-08-16 virou só uma RESERVA.** `respostas`/`dicas` continuam em cada item de
    `CENARIOS` — se as duas tentativas de IA falharem (proxy fora do ar, sem rede), `enviarMensagem()` cai
    nesse roteiro cíclico antigo pra encenação continuar funcionando offline. Diferença importante: no
    fallback **o objetivo nunca é marcado como cumprido** (só a IA consegue avaliar isso), então uma rodada
    inteira em modo de reserva não gera XP — é uma limitação aceita, não um bug.
  - **Indicador "digitando"** (`mostrarDigitando`/`esconderDigitando`, 3 pontinhos pulsando dentro de um balão
    do personagem) enquanto espera a resposta; campo e botão de enviar ficam `disabled`
    (`travarCompositor`) pra não deixar mandar 2 mensagens em paralelo.
  - **Guarda de corrida (`estado.sessaoId`):** se o adolescente fechar o cenário (ou abrir outro) enquanto uma
    resposta da IA ainda está a caminho, a resposta atrasada é descartada ao chegar (`estado.sessaoId !==
    sessaoId capturado no envio`) — sem isso, uma resposta tardia do cenário A poderia aparecer dentro do
    cenário B já aberto.
  - Não existe "resposta errada" do lado da mensagem em si — qualquer mensagem sempre avança a cena e sempre
    vem com uma dica (mesma filosofia de erro-silencioso dos outros jogos, adaptada pra conversa).
- **Sinal de risco (autolesão/agressão) — mesmo padrão do diário/calendário.** Como o campo agora é conversa
  livre pra uma IA (antes só disparava uma de 3 respostas fixas), ficou exposto ao mesmo risco que já existia
  no diário: `categoriaRiscoRoleplay()` + `SINAIS_AUTOLESAO`/`SINAIS_AGRESSAO` são **cópia local** (prefixo
  `rp*`, mesmas listas e mesma lógica de borda de `diario.html` — não importa de lá de propósito, pra não
  arriscar aquele sistema). Roda em `avisarCuidadorSeNecessario()` a cada mensagem enviada, **em paralelo**
  com a chamada da IA (não trava o envio): se detectar, insere direto em `alertas` (`tipo:'crise'` pra
  autolesão / `'aviso'` pra agressão, `destino:'responsavel'`) — mesmo insert direto do cliente que o diário
  usa (a policy `alertas_self` já permite). **O adolescente nunca é avisado disso e a mensagem nunca é
  bloqueada** — só a resposta da IA para aquela mensagem segue normal.
- **Modal de encenação** (`.rp-backdrop`/`.rp-modal`) é construção nova, não a `LumiUI.painel()` genérica
  (`js/core/ui.js`): a `LumiUI` resolve UMA vez com um botão e fecha — não serve pra um chat que fica aberto
  recebendo várias mensagens. Mas reaproveita os MESMOS princípios de acessibilidade dela (foco vai pro campo
  de digitação ao abrir, Tab/Shift+Tab presos dentro do modal, Esc fecha, foco volta pro botão "Tentar de
  novo" ao concluir, `overflow:hidden` no body enquanto aberto) — escritos de novo em `roleplay.js` porque a
  `LumiUI` não expõe o elemento do diálogo pra ser mutado depois de aberto.
  ⚠️ **Achado só no screenshot, não na leitura do código:** o cabeçalho do modal tem DOIS botões circulares
  (som + fechar). `J.ligarBotaoSom` (o helper de todo jogo) usa os ícones `radio`/`x` — com o som desligado
  (padrão), ele mostra um X **idêntico** ao X de fechar do lado, os dois ficam indistinguíveis visualmente. Em
  todo outro jogo esse botão fica sozinho numa barra, longe de qualquer X; aqui é o primeiro caso em que ele
  fica ao lado de um close real. Resolvido com `ligarBotaoSomModal()` (função própria em `roleplay.js`) que
  reaproveita o ESTADO/lógica de verdade (`J.som.alternar/ligado/disponivel/acerto/calar` — mesma chave de
  localStorage `lt-jogos-som`, mesmo respeito ao modo calmo) mas troca só o ícone por `volume-2`, com opacidade
  reduzida quando desligado (`#rp-btn-som[aria-pressed="false"] svg`). O botão de fechar também ganhou
  `.rp-icone-btn--fechar` (preenchimento mais sólido) como reforço visual. **Se algum dia esse botão de som
  voltar a ficar sozinho numa barra (fora do modal), pode voltar a usar `J.ligarBotaoSom` direto.**
- **Sugestão de frase ("Ideia"):** banner âmbar com a frase pronta do cenário; "Usar essa frase" só copia pro
  campo, não envia sozinho — o adolescente ainda escolhe apertar enviar (ou editar antes). Continua estático
  (não vem da IA), então funciona mesmo se a IA estiver fora do ar.
- **XP só é concedido se a IA marcar o objetivo da cena como cumprido em algum momento da conversa**
  (`estado.objetivoCumprido`, decisão do usuário em 2026-08-16 — a v1 dava XP só por fechar/tentar, sem checar
  se a habilidade foi realmente praticada). Ao concluir (`concluirTreino`, disparado pelo X, pelo botão
  "Concluir treino", por Esc ou por clicar fora do cartão): se cumpriu, `pontuacao = Math.max(20, falasDoUsuário
  × 10)` e a tela de fim é a de sempre (urso-joia, "+N XP"); se NÃO cumpriu, `pontuacao = 0` (sem `J.ganharXP`),
  tela de fim neutra (`img/urso-conersando.png`, "Tudo bem por hoje... pode voltar quando quiser") — **de
  propósito sem soar como fracasso** (decisão do usuário). Nos dois casos `J.salvarSessao` grava a tentativa em
  `sessoes_jogo` (útil pro cuidador ver que houve prática, mesmo com pontuação 0). Uma vez cumprido, um banner
  verde (`#rp-objetivo-ok`) fica visível pro resto da conversa — o adolescente pode continuar treinando ou
  concluir quando quiser, o XP não é perdido se ele continuar depois de já ter alcançado o objetivo.
- ⚠️ **Achado só no screenshot, não na leitura do código (avatar cortado ao meio):** a versão importada do
  `.dc.html` original punha o círculo do personagem com `margin-top: -26px`, flutuando de propósito meio na
  faixa azul do cabeçalho, meio no corpo branco do modal — no navegador de verdade isso lê como um círculo
  cortado ao meio (foi assim que o usuário descreveu, achando que era bug), não como um efeito estético.
  Corrigido: `.rp-avatar` perdeu a margem negativa e a borda branca, mora inteiro dentro do corpo branco logo
  abaixo do cabeçalho, só com `box-shadow` pra dar sensação de elevação. **Não reintroduzir esse overlap.**
- Verificado com **jsdom** (42 asserções: 7 cards com os 7 ids certos, abrir/fechar do modal, foco indo pro
  campo ao abrir, conversa real com `groqFetch` mockado — indicador "digitando" aparece/some e o compositor
  trava/destrava durante a chamada —, XP concedido só quando `concluido:true`, tela de fim neutra sem XP e sem
  linguagem de fracasso quando `concluido:false`, roteiro de reserva assume quando as duas tentativas de IA
  falham (e nunca dá XP nesse caso), sinal de risco gera exatamente 1 alerta com `tipo`/`destino`/`titulo`
  corretos e o adolescente não vê nenhuma menção a isso, falso-positivo "matei aula" não dispara alerta,
  **XSS escapado tanto na mensagem do usuário quanto na resposta/dica "vindas da IA"** — o `esc()` em
  `bolhaHTML` não confia em nenhuma fonte —, Escape sem enviar nada conclui sem XP) + `node --check` +
  Chrome headless (grade, modal com indicador "digitando", banner de objetivo cumprido, tela de fim com
  sucesso) — foi assim que a colisão visual dos dois botões circulares do cabeçalho (som vs. fechar) apareceu
  na v1, só no render (ver memória `render-visual-com-chrome-headless`).

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

## 🛡️ Bloqueio de segurança do chat da comunidade — só teen (2026-08-14)
Retomado de uma conversa perdida numa troca de máquina (sem rastro local — nem git, nem memória entre
sessões — então foi desenhado do zero a partir do pedido do usuário). Ao detectar **sinal de risco**
(ideação suicida/autolesão) ou **linguagem ofensiva grave** numa mensagem do chat da comunidade, o
adolescente é bloqueado de postar por **1 hora** e o **responsável vinculado é avisado** — cuidador
**não** entra nesse fluxo (só o teen; comportamento confirmado com o usuário).
- **A mensagem NUNCA chega a ser inserida na sala** — a detecção roda no cliente (`js/chat.js`) ANTES do
  insert. Duas listas: `SINAIS_RISCO` (autolesão/suicídio — reaproveita a lista que já existia pro "aceno
  de apoio" do cuidador) e `PALAVRAS_OFENSIVAS` (xingamentos: "vai tomar no cu", "filho da puta", "puta",
  "porra", "caralho" etc. — só termos inequívocos; palavras ambíguas como "piranha"/"corno" (bicho) ficaram
  de fora de propósito). `contemTermo()` casa frase (tem espaço) por substring direto, e palavra única por
  regex com borda de INÍCIO (evita "puta" pegando "disputa"/"reputação") mas SEM borda de fim (é o que
  deixa "suicíd" continuar pegando "suicídio"/"suicida" sem listar cada inflexão — cuidado ao mexer aqui,
  as duas regras têm razão de ser).
- **O responsável vê o trecho exato que o teen escreveu, o teen NÃO sabe que foi avisado** (ajuste pedido
  pelo usuário em 2026-08-14, depois da primeira versão). `trechoDetectado()` extrai da mensagem ORIGINAL
  (preserva maiúsc./minúsc., não usa a forma truncada da lista interna) — frase, o próprio termo já é o
  trecho; palavra única, estende até o fim da palavra digitada (ex.: gatilho interno "suicíd" + texto
  "suicídio" → trecho "suicídio"). Esse trecho vai pra RPC (`p_trecho`) e entra no `alertas.descricao` do
  responsável ("Trecho: "..."."); as mensagens mostradas AO TEEN (toast do Lumi Theo + banner de bloqueio)
  não mencionam o responsável em nenhum momento — só falam do próprio bloqueio de 1h.
- **Reforçado no banco, não só no cliente** (`db/CHAT_SEGURANCA.sql`, aplicado em produção): tabela nova
  `chat_bloqueios` (RLS ligado, **sem policy de insert/update/delete pra `authenticated`** — só a função
  abaixo escreve, então o teen não consegue se autodesbloquear limpando estado local ou chamando o
  PostgREST direto) + função `registrar_bloqueio_chat(p_motivo, p_trecho)` **SECURITY DEFINER** (2 args —
  a versão antiga de 1 arg foi dropada, não ficou órfã) que grava o bloqueio E o alerta pro responsável na
  mesma chamada (`alertas`, tipo `'crise'` pro sinal de risco / `'aviso'` pra linguagem ofensiva — dois
  textos diferentes de propósito, pra não soar "crise" num palavrão comum). `p_trecho` é truncado em 200
  chars (`left()`) dentro da função — defesa extra, mesmo a função sendo chamável só por quem já está
  autenticado; a tela do cuidador já escapa `descricao` com `esc()` em todo lugar que lê `alertas`
  (`alertas-cuidador.html`, `home-cuidador.html`, `relatorios-cuidador.html`), então não há XSS mesmo se
  o texto viesse de um cliente adulterado. A policy `chat_insert` de `comunidade_chat` nega quem estiver
  com `chat_bloqueios.bloqueado_ate > now()`. Reaproveita a tabela `alertas` que já existia (nenhuma
  coluna nova nela) — o alerta já aparece sozinho no badge/lista do painel do cuidador, nenhuma tela do
  cuidador precisou de mudança.
- **UI do bloqueio**: banner `.ch-bloqueio` (âmbar, `css/chat.css`) no topo do compositor, com contagem
  regressiva (`setInterval` de 15s que reavalia e destrava sozinho quando o tempo passa) + input/botões
  desabilitados. `carregarBloqueio()` roda ao abrir a página pra reaplicar a UI se já havia bloqueio ativo
  (ex.: deu refresh no meio da hora). Se o insert cair na RLS mesmo assim (bloqueio criado por outra
  aba/dispositivo entre a checagem local e o envio, código `42501`), resincroniza em vez de mostrar erro
  genérico.
- O **cuidador continua com o comportamento antigo** (`checarSinais`, inalterado): sinal de risco dispara só
  o aceno de apoio privado do Lumi Theo, mensagem é enviada normalmente — nunca bloqueia.
- Verificado com **jsdom** (30 asserções: envio normal, bloqueio por risco, bloqueio por ofensa, trecho
  exato mandado na RPC (frase e palavra-com-inflexão), ausência do CTA de crise numa ofensa comum, nenhuma
  das duas mensagens mostradas ao teen menciona "responsável", falso-positivo de borda de palavra, bloqueio
  já ativo ao abrir a página, cuidador nunca bloqueia, bloqueio resiste a reabilitar o botão pelo cliente) +
  migração conferida em produção via Management API (tabela, função `SECURITY DEFINER` de 2 args — e só
  ela, a de 1 arg foi confirmada removida —, grant de execução, RLS ligado, nenhuma policy de escrita em
  `chat_bloqueios` pra `authenticated`, texto exato da nova policy `chat_insert`).

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

## 📅 Sinal de risco em evento do calendário (2026-08-15)
Extensão do mesmo padrão do diário (ver seção abaixo) pro calendário: usuário pediu depois de o bug do
diário aparecer — e se o adolescente marcar um compromisso como "Dia de me matar"/"Dia do suicidio"/
"Suicidio"? O calendário não passa por IA (só cadastro direto), então a única camada possível aqui é a
determinística.
- **`calendario.html`** ganhou `trechoRiscoEvento(titulo,descricao)` + `avisarCuidadorSeRiscoEvento()`,
  chamada dentro de `adicionarEvento()` logo após o insert (roda nos dois caminhos, com ou sem as colunas
  novas da migration). Escopo confirmado com o usuário: **só autolesão/suicídio** (mesma lista
  `SINAIS_AUTOLESAO` do diário/chat — não inclui a lista de agressão a terceiros), **título + descrição**
  do evento, **nunca bloqueia** a criação (evento sempre salva, alerta é só um efeito colateral silencioso),
  e **só do lado do adolescente** — `calendario-cuidador.html` não tem esse código, de propósito (o
  cuidador não é o público de risco). Mesmo padrão de "o teen não sabe que foi avisado".
- Não existe função de editar evento em `calendario.html` (só `adicionarEvento`/`delEv`), então um único
  ponto de chamada cobre o fluxo inteiro.
- Cópia local das funções (`calContemTermo`/`calTrechoDetectado`), mesma razão do diário: não importar de
  `js/chat.js` pra não arriscar aquele sistema.
- Conferido com `node --check` + script Node isolado testando os 3 exemplos exatos do usuário ("Dia de me
  matar", "Dia do suicidio", "Suicidio" — todos → alerta), um caso com o sinal só na descrição (→ alerta) e
  2 eventos normais (→ `null`).

## 📖 Diário: reflexão da IA não podia validar dano a si/outros (2026-08-14)
Usuário reportou: entrada de diário dizendo "bati em um amigo"/"matei um amigo" recebia uma reflexão da
Lumi Theo que **apoiava a fala inteira** sem nomear o problema — o prompt só mandava "validar o sentimento",
sem distinguir sentimento de ação. `diario.html` também tinha **zero detecção de risco**, diferente do chat
da comunidade (`js/chat.js`), que já bloqueia e avisa o responsável por sinal de autolesão/ofensa — o diário
é privado, então nada ali passava por esse crivo.
- **Prompt de `gerarReflexaoLumi()` (`diario.html`) ganhou uma regra explícita**: validar o SENTIMENTO nunca
  é validar a AÇÃO que machucou alguém (o próprio adolescente ou outra pessoa) — acolher o sentimento por
  trás (raiva/frustração/desespero), mas nomear a ação como não certa, orientar reparação (pedir desculpa,
  conversar) ou buscar um adulto de confiança, e nunca elogiar/comemorar a ação. Sinal de risco à vida
  prioriza acolhimento + CVV 188 em vez da dica prática comum. Essa é a defesa principal (cobre qualquer
  frase, não só palavra-chave).
- **Camada determinística nova, independente da IA**: `categoriaRiscoDiario()` em `diario.html` (prefixo
  `dia*` pras funções, cópia local — **não** importa de `js/chat.js` de propósito, pra não arriscar o
  sistema do chat que acabou de ser testado/deployado no mesmo dia). Duas listas: `SINAIS_AUTOLESAO` (mesmos
  termos do chat) e `SINAIS_AGRESSAO` (nova — "bati em/no/na", "agredi", "matei ele/ela/um amigo" etc.,
  só frases com objeto de pessoa, de propósito pra não pegar gíria comum tipo "matei aula"/"bati um
  recorde" — conferido com casos de teste). Ao detectar, `avisarCuidadorSeNecessario()` grava direto em
  `alertas` (tipo `'crise'` pra autolesão / `'aviso'` pra agressão, `destino:'responsavel'`) — **insert
  direto do cliente, sem RPC nova**, porque a policy `alertas_self` já é `FOR ALL USING (id_neurodivergente
  = auth.uid())`, então o teen já podia inserir alerta pra si mesmo; nenhuma migração de banco foi
  necessária. **O diário nunca bloqueia nem avisa o teen** — só salva normal e roda a reflexão corrigida;
  o aviso ao responsável é silencioso, mesmo padrão de "o teen não sabe que foi avisado" do chat.
- Conferido com `node --check` (sintaxe) + um script Node isolado rodando `categoriaRiscoDiario()` contra os
  dois textos reais do bug relatado (ambos → `agressao`) e 5 casos de falso-positivo (`matei aula`, `bati um
  recorde`, `disputa acirrada` etc. → `null`).

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
- Novo jogo "Roleplay" (6º item do hub, `roleplay.html`) importado do Claude Design e adicionado ao
  `games.html` (2026-08-16) — ver a seção "Roleplay — encenação de conversas do dia a dia".

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
