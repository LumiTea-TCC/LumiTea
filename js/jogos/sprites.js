/* ============================================================
   LumiTEA — js/jogos/sprites.js
   Biblioteca de figuras dos jogos, desenhadas em SVG aqui mesmo.

   Por que SVG e não imagens: fica nítido em qualquer tamanho,
   funciona offline, não pesa no carregamento e nunca some se o
   arquivo de imagem faltar.

   API:
     LUMIJOGOS.sprites.TEMAS          → { chave: {nome, itens[]} }
     LUMIJOGOS.sprites.figura(item)   → string SVG do item
     LUMIJOGOS.sprites.FORMAS         → { chave: {nome, path} }
     LUMIJOGOS.sprites.CORES          → [{ chave, nome, hex }]
     LUMIJOGOS.sprites.forma(f,c,t)   → string SVG de forma+cor+tamanho

   Cada item tem { id, nome, svg } — "nome" é a palavra em
   português usada pela narração e pelo jogo imagem-palavra.
   ============================================================ */
(function (g) {
  'use strict';
  g.LUMIJOGOS = g.LUMIJOGOS || {};

  function env(inner) {
    return '<svg class="jg-fig" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  /* ── Paleta das figuras ──────────────────────────────────── */
  var C = {
    escuro: '#1a2e4a', branco: '#fdfdff', creme: '#fdf3e3',
    azul: '#4a7eb5', azulEsc: '#2e5fa3', ceu: '#c7e0f7',
    verde: '#3f9e73', verdeEsc: '#2f7d5a', menta: '#cfeee6',
    ambar: '#e0a52e', laranja: '#e08e30', vermelho: '#d15b4c',
    violeta: '#7c5cbf', rosa: '#d95bb5', marrom: '#8a6b4f',
    cinza: '#8fa4ba', cinzaEsc: '#5f7a95'
  };

  function olhos(x1, x2, y, r) {
    r = r || 3;
    return '<circle cx="' + x1 + '" cy="' + y + '" r="' + r + '" fill="' + C.escuro + '"/>' +
           '<circle cx="' + x2 + '" cy="' + y + '" r="' + r + '" fill="' + C.escuro + '"/>';
  }

  /* ============================================================
     TEMA: ANIMAIS
     ============================================================ */
  var ANIMAIS = [
    { id: 'gato', nome: 'gato', svg: env(
      '<path d="M26 40 L22 16 L42 28 Z" fill="' + C.cinza + '"/>' +
      '<path d="M74 40 L78 16 L58 28 Z" fill="' + C.cinza + '"/>' +
      '<circle cx="50" cy="56" r="30" fill="' + C.cinza + '"/>' +
      olhos(39, 61, 52, 3.4) +
      '<path d="M46 64 L54 64 L50 69 Z" fill="' + C.rosa + '"/>' +
      '<path d="M18 58 H34 M18 66 H34 M66 58 H82 M66 66 H82" stroke="' + C.escuro + '" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>') },

    { id: 'cachorro', nome: 'cachorro', svg: env(
      '<ellipse cx="22" cy="50" rx="11" ry="20" fill="' + C.marrom + '"/>' +
      '<ellipse cx="78" cy="50" rx="11" ry="20" fill="' + C.marrom + '"/>' +
      '<circle cx="50" cy="52" r="29" fill="#a9825f"/>' +
      olhos(40, 60, 47, 3.4) +
      '<ellipse cx="50" cy="66" rx="15" ry="11" fill="' + C.creme + '"/>' +
      '<ellipse cx="50" cy="61" rx="6" ry="4.5" fill="' + C.escuro + '"/>' +
      '<path d="M50 66 V72" stroke="' + C.escuro + '" stroke-width="2" stroke-linecap="round"/>') },

    { id: 'coelho', nome: 'coelho', svg: env(
      '<ellipse cx="38" cy="26" rx="8" ry="20" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      '<ellipse cx="62" cy="26" rx="8" ry="20" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      '<ellipse cx="38" cy="27" rx="3.5" ry="13" fill="' + C.rosa + '" opacity=".55"/>' +
      '<ellipse cx="62" cy="27" rx="3.5" ry="13" fill="' + C.rosa + '" opacity=".55"/>' +
      '<circle cx="50" cy="63" r="26" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      olhos(41, 59, 60, 3.2) +
      '<path d="M46 69 L54 69 L50 74 Z" fill="' + C.rosa + '"/>') },

    { id: 'urso', nome: 'urso', svg: env(
      '<circle cx="26" cy="30" r="12" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      '<circle cx="74" cy="30" r="12" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      '<circle cx="50" cy="55" r="31" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      olhos(39, 61, 50, 3.4) +
      '<ellipse cx="50" cy="66" rx="14" ry="10" fill="' + C.ceu + '"/>' +
      '<ellipse cx="50" cy="62" rx="5.5" ry="4" fill="' + C.escuro + '"/>') },

    { id: 'peixe', nome: 'peixe', svg: env(
      '<path d="M14 50 L36 32 L36 68 Z" fill="' + C.azulEsc + '"/>' +
      '<ellipse cx="58" cy="50" rx="30" ry="22" fill="' + C.azul + '"/>' +
      '<path d="M56 30 Q64 20 72 30 Z" fill="' + C.azulEsc + '"/>' +
      '<circle cx="74" cy="45" r="4" fill="' + C.branco + '"/>' +
      '<circle cx="75" cy="45" r="2.2" fill="' + C.escuro + '"/>' +
      '<path d="M46 50 Q56 58 66 50" stroke="' + C.branco + '" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>') },

    { id: 'passaro', nome: 'pássaro', svg: env(
      '<path d="M30 44 Q10 34 12 54 Q22 58 32 54 Z" fill="' + C.verdeEsc + '"/>' +
      '<circle cx="52" cy="50" r="26" fill="' + C.verde + '"/>' +
      '<path d="M76 46 L92 51 L76 56 Z" fill="' + C.ambar + '"/>' +
      '<circle cx="62" cy="42" r="4" fill="' + C.branco + '"/>' +
      '<circle cx="63" cy="42" r="2.2" fill="' + C.escuro + '"/>' +
      '<path d="M44 70 L40 84 M56 72 L58 86" stroke="' + C.ambar + '" stroke-width="3" stroke-linecap="round"/>') },

    { id: 'tartaruga', nome: 'tartaruga', svg: env(
      '<circle cx="80" cy="54" r="11" fill="' + C.verde + '"/>' +
      '<circle cx="84" cy="51" r="2.4" fill="' + C.escuro + '"/>' +
      '<rect x="22" y="62" width="10" height="16" rx="5" fill="' + C.verde + '"/>' +
      '<rect x="52" y="62" width="10" height="16" rx="5" fill="' + C.verde + '"/>' +
      '<path d="M12 60 Q14 26 46 26 Q78 26 80 60 Z" fill="' + C.verdeEsc + '"/>' +
      '<path d="M46 26 V60 M22 33 L30 60 M70 33 L62 60" stroke="' + C.menta + '" stroke-width="2.6" fill="none"/>') },

    { id: 'abelha', nome: 'abelha', svg: env(
      '<ellipse cx="36" cy="34" rx="16" ry="11" fill="' + C.ceu + '" opacity=".85" transform="rotate(-24 36 34)"/>' +
      '<ellipse cx="64" cy="34" rx="16" ry="11" fill="' + C.ceu + '" opacity=".85" transform="rotate(24 64 34)"/>' +
      '<ellipse cx="50" cy="58" rx="24" ry="19" fill="' + C.ambar + '"/>' +
      '<path d="M42 41 V75 M56 41 V75" stroke="' + C.escuro + '" stroke-width="5.5" stroke-linecap="round"/>' +
      '<circle cx="30" cy="52" r="2.6" fill="' + C.escuro + '"/>' +
      '<path d="M32 40 L26 28 M40 38 L38 26" stroke="' + C.escuro + '" stroke-width="2" stroke-linecap="round"/>') }
  ];

  /* ============================================================
     TEMA: VEÍCULOS
     ============================================================ */
  var VEICULOS = [
    { id: 'carro', nome: 'carro', svg: env(
      '<path d="M24 52 L34 32 H66 L76 52 Z" fill="' + C.azulEsc + '"/>' +
      '<rect x="12" y="50" width="76" height="22" rx="8" fill="' + C.azul + '"/>' +
      '<rect x="38" y="36" width="24" height="14" rx="3" fill="' + C.ceu + '"/>' +
      '<circle cx="30" cy="74" r="10" fill="' + C.escuro + '"/><circle cx="30" cy="74" r="4" fill="' + C.cinza + '"/>' +
      '<circle cx="70" cy="74" r="10" fill="' + C.escuro + '"/><circle cx="70" cy="74" r="4" fill="' + C.cinza + '"/>') },

    { id: 'onibus', nome: 'ônibus', svg: env(
      '<rect x="12" y="22" width="76" height="50" rx="9" fill="' + C.ambar + '"/>' +
      '<rect x="19" y="30" width="20" height="16" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="43" y="30" width="18" height="16" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="65" y="30" width="16" height="16" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="12" y="54" width="76" height="5" fill="' + C.laranja + '"/>' +
      '<circle cx="30" cy="76" r="9" fill="' + C.escuro + '"/><circle cx="30" cy="76" r="3.5" fill="' + C.cinza + '"/>' +
      '<circle cx="70" cy="76" r="9" fill="' + C.escuro + '"/><circle cx="70" cy="76" r="3.5" fill="' + C.cinza + '"/>') },

    { id: 'aviao', nome: 'avião', svg: env(
      '<path d="M46 12 Q56 12 58 30 L58 52 L88 68 V76 L58 68 L57 82 L68 90 V94 L50 89 L32 94 V90 L43 82 L42 68 L12 76 V68 L42 52 L42 30 Q44 12 46 12 Z" fill="' + C.azul + '"/>' +
      '<circle cx="50" cy="34" r="5" fill="' + C.ceu + '"/>') },

    { id: 'barco', nome: 'barco', svg: env(
      '<path d="M52 12 L52 54 L84 54 Z" fill="' + C.vermelho + '"/>' +
      '<path d="M46 22 L46 54 L20 54 Z" fill="' + C.creme + '" stroke="' + C.cinza + '" stroke-width="1.6"/>' +
      '<rect x="47" y="10" width="3.5" height="48" rx="1.6" fill="' + C.marrom + '"/>' +
      '<path d="M10 58 H90 L80 80 H20 Z" fill="' + C.marrom + '"/>' +
      '<path d="M8 86 Q20 80 32 86 T56 86 T80 86" stroke="' + C.azul + '" stroke-width="3" fill="none" stroke-linecap="round"/>') },

    { id: 'bicicleta', nome: 'bicicleta', svg: env(
      '<circle cx="26" cy="66" r="19" fill="none" stroke="' + C.azulEsc + '" stroke-width="4.5"/>' +
      '<circle cx="74" cy="66" r="19" fill="none" stroke="' + C.azulEsc + '" stroke-width="4.5"/>' +
      '<path d="M26 66 L46 40 L64 40 L74 66 M46 40 L54 66 L26 66" stroke="' + C.vermelho + '" stroke-width="4" fill="none" stroke-linejoin="round"/>' +
      '<path d="M40 34 H54 M64 40 L70 32" stroke="' + C.escuro + '" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="54" cy="66" r="4" fill="' + C.escuro + '"/>') },

    { id: 'trem', nome: 'trem', svg: env(
      '<rect x="10" y="40" width="52" height="32" rx="6" fill="' + C.verde + '"/>' +
      '<rect x="62" y="26" width="28" height="46" rx="6" fill="' + C.verdeEsc + '"/>' +
      '<rect x="18" y="46" width="16" height="14" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="40" y="46" width="16" height="14" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="68" y="34" width="16" height="14" rx="3" fill="' + C.ceu + '"/>' +
      '<rect x="20" y="26" width="12" height="14" rx="3" fill="' + C.cinzaEsc + '"/>' +
      '<circle cx="26" cy="78" r="7" fill="' + C.escuro + '"/><circle cx="50" cy="78" r="7" fill="' + C.escuro + '"/><circle cx="76" cy="78" r="7" fill="' + C.escuro + '"/>') },

    { id: 'foguete', nome: 'foguete', svg: env(
      '<path d="M50 8 Q68 30 68 58 H32 Q32 30 50 8 Z" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2"/>' +
      '<path d="M32 44 L16 72 L32 66 Z" fill="' + C.vermelho + '"/>' +
      '<path d="M68 44 L84 72 L68 66 Z" fill="' + C.vermelho + '"/>' +
      '<rect x="32" y="58" width="36" height="10" rx="3" fill="' + C.cinza + '"/>' +
      '<circle cx="50" cy="36" r="8" fill="' + C.ceu + '" stroke="' + C.azulEsc + '" stroke-width="2"/>' +
      '<path d="M42 70 Q50 92 58 70 Z" fill="' + C.ambar + '"/>') },

    { id: 'caminhao', nome: 'caminhão', svg: env(
      '<rect x="8" y="30" width="44" height="40" rx="5" fill="' + C.violeta + '"/>' +
      '<path d="M54 44 H72 L88 58 V70 H54 Z" fill="#9a7fd0"/>' +
      '<rect x="60" y="48" width="16" height="11" rx="3" fill="' + C.ceu + '"/>' +
      '<circle cx="28" cy="76" r="9" fill="' + C.escuro + '"/><circle cx="28" cy="76" r="3.5" fill="' + C.cinza + '"/>' +
      '<circle cx="72" cy="76" r="9" fill="' + C.escuro + '"/><circle cx="72" cy="76" r="3.5" fill="' + C.cinza + '"/>') }
  ];

  /* ============================================================
     TEMA: FRUTAS
     ============================================================ */
  var FRUTAS = [
    { id: 'maca', nome: 'maçã', svg: env(
      '<path d="M50 30 Q34 22 24 36 Q14 52 26 74 Q36 90 50 80 Q64 90 74 74 Q86 52 76 36 Q66 22 50 30 Z" fill="' + C.vermelho + '"/>' +
      '<rect x="48" y="14" width="4" height="18" rx="2" fill="' + C.marrom + '"/>' +
      '<path d="M52 22 Q70 10 74 24 Q60 32 52 22 Z" fill="' + C.verde + '"/>') },

    { id: 'banana', nome: 'banana', svg: env(
      '<path d="M20 26 Q22 68 58 80 Q86 88 88 62 Q78 74 56 66 Q34 56 32 24 Z" fill="' + C.ambar + '"/>' +
      '<path d="M20 26 L32 24" stroke="' + C.marrom + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M88 62 L86 70" stroke="' + C.marrom + '" stroke-width="5" stroke-linecap="round"/>') },

    { id: 'uva', nome: 'uva', svg: env(
      '<rect x="48" y="12" width="4" height="14" rx="2" fill="' + C.marrom + '"/>' +
      '<path d="M52 20 Q70 12 74 24 Q60 30 52 20 Z" fill="' + C.verde + '"/>' +
      '<circle cx="38" cy="38" r="11" fill="' + C.violeta + '"/><circle cx="62" cy="38" r="11" fill="' + C.violeta + '"/>' +
      '<circle cx="28" cy="56" r="11" fill="#8f6fce"/><circle cx="50" cy="54" r="11" fill="#8f6fce"/><circle cx="72" cy="56" r="11" fill="#8f6fce"/>' +
      '<circle cx="39" cy="72" r="11" fill="' + C.violeta + '"/><circle cx="61" cy="72" r="11" fill="' + C.violeta + '"/>') },

    { id: 'laranja', nome: 'laranja', svg: env(
      '<circle cx="50" cy="56" r="33" fill="' + C.laranja + '"/>' +
      '<path d="M50 23 V89 M21 40 L79 72 M21 72 L79 40" stroke="#f2b46a" stroke-width="2.4" opacity=".8"/>' +
      '<rect x="48" y="14" width="4" height="12" rx="2" fill="' + C.marrom + '"/>' +
      '<path d="M52 20 Q70 12 72 24 Q58 30 52 20 Z" fill="' + C.verde + '"/>') },

    { id: 'morango', nome: 'morango', svg: env(
      '<path d="M50 88 Q18 66 20 42 Q22 28 50 28 Q78 28 80 42 Q82 66 50 88 Z" fill="' + C.vermelho + '"/>' +
      '<path d="M32 26 H68 L60 36 H40 Z" fill="' + C.verde + '"/>' +
      '<rect x="48" y="14" width="4" height="12" rx="2" fill="' + C.verdeEsc + '"/>' +
      '<circle cx="40" cy="46" r="2.4" fill="' + C.creme + '"/><circle cx="58" cy="44" r="2.4" fill="' + C.creme + '"/>' +
      '<circle cx="50" cy="58" r="2.4" fill="' + C.creme + '"/><circle cx="35" cy="60" r="2.4" fill="' + C.creme + '"/>' +
      '<circle cx="64" cy="58" r="2.4" fill="' + C.creme + '"/><circle cx="50" cy="72" r="2.4" fill="' + C.creme + '"/>') },

    { id: 'melancia', nome: 'melancia', svg: env(
      '<path d="M10 68 A40 40 0 0 1 90 68 Z" fill="' + C.verdeEsc + '"/>' +
      '<path d="M17 68 A33 33 0 0 1 83 68 Z" fill="' + C.creme + '"/>' +
      '<path d="M22 68 A28 28 0 0 1 78 68 Z" fill="' + C.vermelho + '"/>' +
      '<circle cx="40" cy="56" r="2.6" fill="' + C.escuro + '"/><circle cx="58" cy="54" r="2.6" fill="' + C.escuro + '"/>' +
      '<circle cx="50" cy="64" r="2.6" fill="' + C.escuro + '"/><circle cx="31" cy="64" r="2.6" fill="' + C.escuro + '"/>' +
      '<circle cx="68" cy="63" r="2.6" fill="' + C.escuro + '"/>') },

    { id: 'pera', nome: 'pera', svg: env(
      '<path d="M50 26 Q62 26 60 42 Q84 56 78 74 Q72 90 50 90 Q28 90 22 74 Q16 56 40 42 Q38 26 50 26 Z" fill="#a8c94e"/>' +
      '<rect x="48" y="12" width="4" height="16" rx="2" fill="' + C.marrom + '"/>' +
      '<path d="M52 20 Q70 10 74 22 Q60 30 52 20 Z" fill="' + C.verde + '"/>') },

    { id: 'limao', nome: 'limão', svg: env(
      '<ellipse cx="50" cy="58" rx="34" ry="27" fill="#d8d84e"/>' +
      '<ellipse cx="50" cy="58" rx="26" ry="19" fill="#e6e678" opacity=".6"/>' +
      '<rect x="48" y="20" width="4" height="14" rx="2" fill="' + C.marrom + '"/>' +
      '<path d="M52 26 Q70 16 74 28 Q60 34 52 26 Z" fill="' + C.verde + '"/>') }
  ];

  /* ============================================================
     TEMA: NATUREZA
     ============================================================ */
  var NATUREZA = [
    { id: 'sol', nome: 'sol', svg: env(
      '<circle cx="50" cy="50" r="24" fill="' + C.ambar + '"/>' +
      '<g stroke="' + C.laranja + '" stroke-width="5" stroke-linecap="round">' +
      '<path d="M50 8 V20 M50 80 V92 M8 50 H20 M80 50 H92 M20 20 L28 28 M72 72 L80 80 M80 20 L72 28 M28 72 L20 80"/></g>') },

    { id: 'lua', nome: 'lua', svg: env(
      '<path d="M62 12 A40 40 0 1 0 62 88 A32 32 0 1 1 62 12 Z" fill="#e8d67a"/>' +
      '<circle cx="40" cy="34" r="5" fill="#d4c069" opacity=".7"/>' +
      '<circle cx="30" cy="56" r="4" fill="#d4c069" opacity=".7"/>') },

    { id: 'nuvem', nome: 'nuvem', svg: env(
      '<circle cx="34" cy="54" r="18" fill="' + C.branco + '"/>' +
      '<circle cx="54" cy="44" r="22" fill="' + C.branco + '"/>' +
      '<circle cx="72" cy="56" r="16" fill="' + C.branco + '"/>' +
      '<rect x="30" y="54" width="46" height="18" rx="9" fill="' + C.branco + '"/>' +
      '<path d="M18 72 H82" stroke="' + C.ceu + '" stroke-width="3" stroke-linecap="round"/>') },

    { id: 'arvore', nome: 'árvore', svg: env(
      '<rect x="45" y="56" width="10" height="32" rx="3" fill="' + C.marrom + '"/>' +
      '<circle cx="50" cy="34" r="20" fill="' + C.verde + '"/>' +
      '<circle cx="32" cy="48" r="15" fill="' + C.verdeEsc + '"/>' +
      '<circle cx="68" cy="48" r="15" fill="' + C.verdeEsc + '"/>' +
      '<circle cx="50" cy="50" r="16" fill="' + C.verde + '"/>' +
      '<path d="M30 88 H70" stroke="#c9b394" stroke-width="4" stroke-linecap="round"/>') },

    { id: 'flor', nome: 'flor', svg: env(
      '<rect x="47" y="52" width="6" height="36" rx="3" fill="' + C.verdeEsc + '"/>' +
      '<path d="M50 70 Q30 62 26 76 Q44 82 50 70 Z" fill="' + C.verde + '"/>' +
      '<circle cx="50" cy="20" r="13" fill="' + C.rosa + '"/>' +
      '<circle cx="76" cy="38" r="13" fill="' + C.rosa + '"/>' +
      '<circle cx="66" cy="66" r="13" fill="' + C.rosa + '"/>' +
      '<circle cx="34" cy="66" r="13" fill="' + C.rosa + '"/>' +
      '<circle cx="24" cy="38" r="13" fill="' + C.rosa + '"/>' +
      '<circle cx="50" cy="44" r="12" fill="' + C.ambar + '"/>') },

    { id: 'estrela', nome: 'estrela', svg: env(
      '<path d="M50 8 L60 36.2 L89.9 37 L66.2 55.3 L74.7 84 L50 67 L25.3 84 L33.8 55.3 L10.1 37 L40 36.2 Z" fill="' + C.ambar + '"/>') },

    { id: 'folha', nome: 'folha', svg: env(
      '<path d="M78 18 Q26 20 22 60 Q20 82 40 84 Q80 82 78 18 Z" fill="' + C.verde + '"/>' +
      '<path d="M76 20 Q46 52 32 82" stroke="' + C.verdeEsc + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path d="M62 32 L48 30 M56 46 L40 46 M48 60 L34 62" stroke="' + C.verdeEsc + '" stroke-width="2.4" stroke-linecap="round"/>') },

    { id: 'montanha', nome: 'montanha', svg: env(
      '<path d="M6 80 L36 30 L58 62 L70 46 L94 80 Z" fill="' + C.cinzaEsc + '"/>' +
      '<path d="M36 30 L26 46 L36 42 L44 48 L48 44 Z" fill="' + C.branco + '"/>' +
      '<path d="M70 46 L64 54 L70 52 L76 56 Z" fill="' + C.branco + '"/>' +
      '<path d="M6 80 H94" stroke="' + C.verde + '" stroke-width="5" stroke-linecap="round"/>') }
  ];

  /* ============================================================
     TEMA: ROTINA (dia a dia — apoio ao vocabulário de ações)
     ============================================================ */
  var ROTINA = [
    { id: 'escova', nome: 'escova de dentes', svg: env(
      '<rect x="24" y="60" width="54" height="9" rx="4.5" fill="' + C.azul + '" transform="rotate(-30 50 64)"/>' +
      '<rect x="60" y="26" width="18" height="14" rx="4" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2" transform="rotate(-30 69 33)"/>' +
      '<path d="M56 30 L68 16 M64 34 L76 20" stroke="' + C.menta + '" stroke-width="5" stroke-linecap="round"/>') },

    { id: 'prato', nome: 'comer', svg: env(
      '<circle cx="50" cy="52" r="32" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2.4"/>' +
      '<circle cx="50" cy="52" r="21" fill="' + C.ceu + '" opacity=".6"/>' +
      '<path d="M16 20 V44 M22 20 V44 M28 20 V44 M22 44 V86" stroke="' + C.cinzaEsc + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M80 20 Q88 30 82 44 L78 44 V86" stroke="' + C.cinzaEsc + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>') },

    { id: 'cama', nome: 'dormir', svg: env(
      '<rect x="12" y="52" width="76" height="24" rx="6" fill="' + C.marrom + '"/>' +
      '<rect x="12" y="42" width="34" height="16" rx="7" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="1.8"/>' +
      '<rect x="44" y="46" width="44" height="12" rx="5" fill="' + C.azul + '"/>' +
      '<rect x="12" y="72" width="8" height="16" rx="3" fill="#6b5340"/>' +
      '<rect x="80" y="72" width="8" height="16" rx="3" fill="#6b5340"/>' +
      '<path d="M62 32 H76 L62 20 H76" stroke="' + C.azulEsc + '" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>') },

    { id: 'banho', nome: 'banho', svg: env(
      '<path d="M22 14 V40 Q22 52 40 52 H76" stroke="' + C.cinzaEsc + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M68 42 H88 L84 58 H72 Z" fill="' + C.cinza + '"/>' +
      '<path d="M72 66 V78 M78 64 V80 M84 66 V78" stroke="' + C.azul + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M14 82 Q30 74 46 82 Q58 88 66 82" stroke="' + C.azul + '" stroke-width="4" fill="none" stroke-linecap="round"/>') },

    { id: 'livro', nome: 'ler', svg: env(
      '<path d="M50 28 Q34 18 14 24 V76 Q34 70 50 80 Q66 70 86 76 V24 Q66 18 50 28 Z" fill="' + C.branco + '" stroke="' + C.cinza + '" stroke-width="2.4"/>' +
      '<path d="M50 28 V80" stroke="' + C.cinza + '" stroke-width="2.4"/>' +
      '<path d="M22 36 H42 M22 48 H42 M58 36 H78 M58 48 H78" stroke="' + C.ceu + '" stroke-width="3" stroke-linecap="round"/>') },

    { id: 'mochila', nome: 'mochila', svg: env(
      '<path d="M34 26 Q34 12 50 12 Q66 12 66 26" stroke="' + C.verdeEsc + '" stroke-width="5" fill="none"/>' +
      '<rect x="20" y="24" width="60" height="60" rx="14" fill="' + C.verde + '"/>' +
      '<rect x="32" y="52" width="36" height="24" rx="7" fill="' + C.menta + '"/>' +
      '<path d="M20 46 H80" stroke="' + C.verdeEsc + '" stroke-width="4"/>') },

    { id: 'agua', nome: 'beber água', svg: env(
      '<path d="M30 26 H70 L64 84 H36 Z" fill="' + C.ceu + '" stroke="' + C.azul + '" stroke-width="2.4"/>' +
      '<path d="M33 48 H67 L64 84 H36 Z" fill="' + C.azul + '" opacity=".65"/>' +
      '<path d="M26 22 H74" stroke="' + C.azulEsc + '" stroke-width="4" stroke-linecap="round"/>') },

    { id: 'relogio', nome: 'relógio', svg: env(
      '<circle cx="50" cy="52" r="34" fill="' + C.branco + '" stroke="' + C.azulEsc + '" stroke-width="4"/>' +
      '<path d="M50 30 V52 L66 62" stroke="' + C.azulEsc + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="52" r="3.4" fill="' + C.azulEsc + '"/>' +
      '<path d="M50 18 V24 M84 52 H78 M50 86 V80 M16 52 H22" stroke="' + C.cinza + '" stroke-width="3" stroke-linecap="round"/>') }
  ];

  var TEMAS = {
    animais:  { nome: 'Animais',   itens: ANIMAIS },
    veiculos: { nome: 'Veículos',  itens: VEICULOS },
    frutas:   { nome: 'Frutas',    itens: FRUTAS },
    natureza: { nome: 'Natureza',  itens: NATUREZA },
    rotina:   { nome: 'Dia a dia', itens: ROTINA }
  };

  /* ============================================================
     FORMAS GEOMÉTRICAS (classificação e encaixe)
     ============================================================ */
  var FORMAS = {
    circulo:   { nome: 'círculo',   artigo: 'o', path: 'M50 10 A40 40 0 1 0 50 90 A40 40 0 1 0 50 10 Z' },
    quadrado:  { nome: 'quadrado',  artigo: 'o', path: 'M14 14 H86 V86 H14 Z' },
    triangulo: { nome: 'triângulo', artigo: 'o', path: 'M50 12 L90 84 L10 84 Z' },
    estrela:   { nome: 'estrela',   artigo: 'a', path: 'M50 8 L60 36.2 L89.9 37 L66.2 55.3 L74.7 84 L50 67 L25.3 84 L33.8 55.3 L10.1 37 L40 36.2 Z' },
    coracao:   { nome: 'coração',   artigo: 'o', path: 'M50 86 C20 64 12 44 12 34 C12 20 24 12 34 12 C42 12 48 17 50 22 C52 17 58 12 66 12 C76 12 88 20 88 34 C88 44 80 64 50 86 Z' },
    losango:   { nome: 'losango',   artigo: 'o', path: 'M50 8 L88 50 L50 92 L12 50 Z' },
    hexagono:  { nome: 'hexágono',  artigo: 'o', path: 'M50 8 L86 29 L86 71 L50 92 L14 71 L14 29 Z' }
  };

  var CORES = [
    { chave: 'vermelho', nome: 'vermelho', hex: '#d15b4c' },
    { chave: 'azul',     nome: 'azul',     hex: '#3f7fbf' },
    { chave: 'amarelo',  nome: 'amarelo',  hex: '#dda423' },
    { chave: 'verde',    nome: 'verde',    hex: '#3f9e73' },
    { chave: 'roxo',     nome: 'roxo',     hex: '#7c5cbf' },
    { chave: 'laranja',  nome: 'laranja',  hex: '#e08e30' }
  ];

  var TAMANHOS = [
    { chave: 'grande',  nome: 'grande',  escala: 1 },
    { chave: 'pequeno', nome: 'pequeno', escala: 0.58 }
  ];

  /* forma(chaveDaForma, hexOuChaveDeCor, chaveDeTamanho) → SVG */
  function forma(chaveForma, cor, tamanho) {
    var f = FORMAS[chaveForma] || FORMAS.circulo;
    var hex = cor;
    for (var i = 0; i < CORES.length; i++) { if (CORES[i].chave === cor) { hex = CORES[i].hex; break; } }
    var esc = 1;
    for (var j = 0; j < TAMANHOS.length; j++) { if (TAMANHOS[j].chave === tamanho) { esc = TAMANHOS[j].escala; break; } }
    var inner = '<path d="' + f.path + '" fill="' + (hex || '#4a7eb5') + '"/>';
    if (esc !== 1) inner = '<g transform="translate(50 50) scale(' + esc + ') translate(-50 -50)">' + inner + '</g>';
    return env(inner);
  }

  /* Silhueta vazada da forma — usada como molde no jogo de encaixe */
  function molde(chaveForma) {
    var f = FORMAS[chaveForma] || FORMAS.circulo;
    return env('<path d="' + f.path + '" fill="#dbe8f5" stroke="#8fa4ba" stroke-width="2.5" stroke-dasharray="6 5"/>');
  }

  g.LUMIJOGOS.sprites = {
    TEMAS: TEMAS,
    FORMAS: FORMAS,
    CORES: CORES,
    TAMANHOS: TAMANHOS,
    figura: function (item) { return item && item.svg ? item.svg : ''; },
    itens: function (tema) { return (TEMAS[tema] || TEMAS.animais).itens.slice(); },
    forma: forma,
    molde: molde
  };
})(window);
