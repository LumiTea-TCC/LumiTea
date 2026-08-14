/* ============================================================
   LumiTEA — tools/gerar-termos-sql.js
   Escreve a lista de termos de `db/MODERACAO_SCHEMA.sql` a partir da
   lista de `js/core/moderacao.js`, que é a FONTE DA VERDADE.

     node tools/gerar-termos-sql.js          escreve
     node tools/gerar-termos-sql.js --check  só confere (sai 1 se
                                             estiver desatualizado)

   Também valida cada termo: minúsculo, sem acento, sem pontuação,
   um espaço só entre palavras. Um termo com acento nunca casaria,
   porque o texto do usuário é normalizado antes da busca — e o erro
   passaria despercebido pra sempre.

   O QUE NÃO VAI PRO BANCO, DE PROPÓSITO:
     LEVE  — "burro", "idiota" e cia. só valem com alvo declarado
             ("você é burro" x "eu sou burro"). Essa leitura de
             contexto mora no cliente; sem ela, o banco bloquearia
             adolescente por autodepreciação. Fora.
     APOIO — não bloqueia nada, a mensagem é publicada. O banco não
             tem o que fazer com ela.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const JS = path.join(RAIZ, 'js', 'core', 'moderacao.js');
const SQL = path.join(RAIZ, 'db', 'MODERACAO_SCHEMA.sql');
const INICIO = '-- >>> TERMOS-GERADOS-INICIO';
const FIM = '-- <<< TERMOS-GERADOS-FIM';

/* Carrega o módulo do navegador num contexto isolado. Ele é um IIFE que
   só pendura funções em `window` — nada de DOM no topo do arquivo. */
function carregarListas() {
  const janela = {};
  vm.runInNewContext(fs.readFileSync(JS, 'utf8'), { window: janela });
  if (!janela.Moderacao || !janela.Moderacao.LISTAS) {
    throw new Error('js/core/moderacao.js não expôs Moderacao.LISTAS');
  }
  return janela.Moderacao.LISTAS;
}

function validar(termo, onde) {
  const erros = [];
  if (termo !== termo.toLowerCase()) erros.push('tem maiúscula');
  if (termo.normalize('NFD') !== termo) erros.push('tem acento');
  if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(termo)) erros.push('tem caractere fora de [a-z0-9 ]');
  if (erros.length) throw new Error(`termo inválido em ${onde}: "${termo}" — ${erros.join(', ')}`);
}

function coletar(listas) {
  const linhas = [];
  const vistos = new Map();

  function add(termo, nivel, categoria, onde) {
    validar(termo, onde);
    if (vistos.has(termo)) {
      // duplicata entre níveis é ambiguidade real: o banco tem PK em termo
      const antes = vistos.get(termo);
      if (antes.nivel !== nivel) {
        throw new Error(`termo "${termo}" aparece como ${antes.nivel}/${antes.categoria} e ${nivel}/${categoria}`);
      }
      return;
    }
    vistos.set(termo, { nivel, categoria });
    linhas.push([termo, nivel, categoria]);
  }

  for (const [nivel, chave] of [['risco', 'RISCO'], ['cuidado', 'CUIDADO'], ['ofensa', 'OFENSA']]) {
    const grupos = listas[chave];
    for (const categoria of Object.keys(grupos)) {
      for (const termo of grupos[categoria]) add(termo, nivel, categoria, `${chave}.${categoria}`);
    }
  }
  for (const termo of listas.EXCECOES) add(termo, 'excecao', 'geral', 'EXCECOES');

  // LEVE e APOIO ficam de fora — ver o cabeçalho.
  return linhas;
}

function montarSQL(linhas) {
  const valores = linhas
    .map(([t, n, c]) => `  ('${t}', '${n}', '${c}')`)
    .join(',\n');
  const porNivel = linhas.reduce((acc, [, n]) => (acc[n] = (acc[n] || 0) + 1, acc), {});
  const resumo = Object.keys(porNivel).sort().map((n) => `${n}: ${porNivel[n]}`).join(', ');

  return [
    INICIO,
    '-- GERADO por `node tools/gerar-termos-sql.js` a partir de js/core/moderacao.js.',
    '-- NÃO EDITE À MÃO: a próxima execução sobrescreve este bloco.',
    `-- ${linhas.length} termos (${resumo}).`,
    '',
    'delete from moderacao_termos;',
    'insert into moderacao_termos (termo, nivel, categoria) values',
    valores + ';',
    '',
    FIM
  ].join('\n');
}

function main() {
  const conferir = process.argv.includes('--check');
  const linhas = coletar(carregarListas());
  const bloco = montarSQL(linhas);

  const sql = fs.readFileSync(SQL, 'utf8');
  const i = sql.indexOf(INICIO);
  const f = sql.indexOf(FIM);
  if (i === -1 || f === -1 || f < i) {
    throw new Error(`marcadores ${INICIO} / ${FIM} não encontrados em db/MODERACAO_SCHEMA.sql`);
  }
  const novo = sql.slice(0, i) + bloco + sql.slice(f + FIM.length);

  if (novo === sql) {
    console.log(`ok — ${linhas.length} termos, db/MODERACAO_SCHEMA.sql já está em dia.`);
    return;
  }
  if (conferir) {
    console.error('desatualizado — rode `node tools/gerar-termos-sql.js`.');
    process.exit(1);
  }
  fs.writeFileSync(SQL, novo);
  console.log(`escrito — ${linhas.length} termos em db/MODERACAO_SCHEMA.sql.`);
}

main();
