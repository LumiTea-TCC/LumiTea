/* ================================================================
   LumiTEA — analise-critica.js
   ─────────────────────────────────────────────────────────────────
   Gera a análise profissional (IA) de um alerta de crise que JÁ foi
   registrado em `alertas` (por qualquer uma das checagens
   determinísticas do app — diário, roleplay, lousa, comunidade).

   Roda DEPOIS do insert do alerta, em paralelo, e nunca bloqueia
   quem chamou: se falhar, o alerta continua salvo e visível pro
   cuidador, só sem o texto de análise. Mesmo padrão "silencioso, em
   paralelo, nunca trava o fluxo do adolescente" usado em todo o
   resto do app pra checagem de risco.

   Uso: window.LUMITEA.gerarAnaliseCritica({
     idAlerta: '<uuid da linha em alertas>',
     origem: 'diário' | 'roleplay' | 'desenho da lousa' | 'comunidade',
     categoria: 'autolesao' | 'agressao' | 'risco' | ...,
     trecho: '<trecho detectado, já truncado>',   // opcional
     contexto: '<texto livre extra>'               // opcional
   });
   ================================================================ */
(function (g) {
  'use strict';

  async function gerarAnaliseCritica(opts) {
    opts = opts || {};
    var idAlerta = opts.idAlerta;
    var sb = g.supabaseClient;
    var LT = g.LUMITEA;
    if (!idAlerta || !sb || !LT || !LT.groqFetch) return;

    var origem = opts.origem || 'app';
    var categoria = opts.categoria || 'desconhecida';
    var trecho = (opts.trecho || '').slice(0, 300);
    var contexto = opts.contexto || '';

    var systemPrompt =
      'Você é um psicólogo especialista em TEA orientando o CUIDADOR de um adolescente autista sobre um ' +
      'sinal de risco detectado pelo app, em ' + origem + '. Categoria: ' + categoria + '.' +
      (trecho ? ' Trecho relevante: "' + trecho + '".' : '') +
      (contexto ? ' Contexto adicional: ' + contexto + '.' : '') +
      '\n\nResponda em português do Brasil, tom profissional e acolhedor (não alarmista, não minimizador), ' +
      'sem markdown, no máximo 4 parágrafos curtos:\n' +
      '1. Resumo direto do que foi detectado.\n' +
      '2. O que isso PODE significar — sem diagnosticar.\n' +
      '3. Duas ou três ações concretas que o cuidador pode tomar agora, com essa criança específica.\n' +
      '4. Quando e como buscar ajuda profissional (cite o CVV 188 se houver risco à vida).';

    try {
      var res = await LT.groqFetch({
        model: LT.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Gere a análise para o cuidador.' }
        ],
        max_tokens: 500, temperature: 0.5
      });
      if (!res.ok) return;
      var data = await res.json();
      var texto = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : '';
      if (!texto) return;

      // Mescla em vez de sobrescrever: metadata pode um dia carregar outras
      // chaves (ex.: a miniatura do desenho da Lousa, ver lousa.js).
      var atual = await sb.from('alertas').select('metadata').eq('id', idAlerta).single();
      var mesclado = Object.assign({}, (atual.data && atual.data.metadata) || {}, { analise_ia: texto.trim() });
      await sb.from('alertas').update({ metadata: mesclado }).eq('id', idAlerta);
    } catch (e) {
      console.warn('[AnaliseCritica] falhou (alerta já está salvo, só sem a análise):', e && e.message);
    }
  }

  g.LUMITEA = g.LUMITEA || {};
  g.LUMITEA.gerarAnaliseCritica = gerarAnaliseCritica;
})(window);
