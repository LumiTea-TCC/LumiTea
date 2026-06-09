# Organização do projeto LumiTEA

Resumo da limpeza feita nesta pasta. Tamanho: **197 MB → 28 MB**.

## Removido (lixo / sem relação com o projeto)

- **`tools/trpg-src/`** (~170 MB) — projeto **Java "Text RPG"** completo, com repositório git
  próprio (`github.com/luix-guxto/Text-Rpg`), um `download.zip` de 48 MB, sprites, e até um
  instalador `.msi`. Não tem nenhuma relação com o LumiTEA — caiu aqui por engano.
  *Era responsável por ~86% do tamanho da pasta.*
- **`LumiTea-redesign/`** — pasta completamente vazia.
- **`img/urso-nogelo-p#U00e9.png`** — cópia exata (mesmo md5) de `img/urso-nogelo-pe.png`,
  só com o nome corrompido (mojibake do "é").

> Nada disso foi apagado do seu zip original — se precisar de algo, ainda está lá.

## Reorganizado

- **`db/`** — movidos os 4 arquivos `.sql` (schema + migrations do Supabase).
- **`docs/`** — movidos `LUMITEA_CHARTER.md`, `PROMPT_UPGRADE.md` e `Read-me`.

Os arquivos do app vanilla (HTML, `app.css`, `lumitea.css`, `conta.css`, `css/`, `js/`, `img/`)
foram **mantidos na raiz de propósito**: eles usam caminhos relativos (`href="lumitea.css"`,
`src="js/core/config.js"`), então mover quebraria o site que roda sem servidor.

## Precisa da sua decisão (não mexi)

- **`web/`** (~13 MB) — é a **migração para Next.js 15 + React + TypeScript** (o próprio README
  confirma). Como você optou por manter o stack vanilla, essa pasta é provavelmente a migração
  abandonada. Se confirmar, dá pra remover e cair pra ~15 MB. Deixei intacta por ser bastante
  trabalho seu.
- **`web/.env.local`** — contém `GROQ_API_KEY` e a chave do Supabase **reais**. Está no
  `.gitignore`, mas continua dentro do zip. **Não suba esse arquivo no GitHub nem inclua no
  pacote da defesa.** Considere rotacionar a chave Groq se ela já circulou.

## Possível redundância (deixei, só sinalizando)

- `img/` tem ~14 imagens sem nenhuma referência no HTML/CSS/JS (ex.: `urso-skate.png`,
  `ursoalblack*.jpg`, `1778065266949.png`). Podem ser assets de reserva — só revise se quiser enxugar.
- `db/`: `SUPABASE_MIGRATION_COMPLETO.sql` (mais recente) talvez substitua os outros `.sql`.
  Mantive todos por serem histórico de migration.
