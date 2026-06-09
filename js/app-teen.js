/* ================================================================
 LumiTEA — app-teen.js (Supabase Edition)
 Lógica da página do adolescente — autenticação e dados via Supabase
 ================================================================ */

/* supabaseClient já definido no HTML via <script> no <head> */

var _userId = null; /* UUID do auth.users */
var _perfil = null; /* objeto { nome, sobrenome, xp, nivel, codigo_vinculo, id_responsavel } */
var _historico = [];
var _carregando = false;
var _micAtivo = false;
var _reconhecimento = null;
var _tipTimeout = null;

/* ── PALAVRAS/PADRÕES QUE ATIVAM O URSO PROFESSOR ─────────────── */
var PADROES_URSO = [
 { re: /\b(idiota|burro|odeio|merda|droga|inferno|lixo|merd)\b/i,
 dica: "Tente expressar o que você está sentindo de outro jeito. Em vez de palavras fortes, diga: 'Estou com raiva' ou 'Isso me machuca'." },
 { re: /\b(n[aã]o sei explicar|n[aã]o consigo falar)\b/i,
 dica: "Tudo bem não saber explicar direitinho. Tente começar com 'Eu me sinto...' e o restante vem naturalmente." },
 { re: /\b(ningu[eé]m me entende|todo mundo me odeia|sou horrível)\b/i,
 dica: "Sentimentos fortes podem parecer verdades, mas não são. Quando você diz 'ninguém', tente pensar: tem alguém que se importa com você?" },
 { re: /\b(n[aã]o quero mais|desistir|cansado de tudo)\b/i,
 dica: "Isso soa como algo pesado. Falar 'estou muito cansado e sobrecarregado' é mais claro e ajuda as pessoas ao seu redor a te apoiar." },
 { re: /\b(t[aã]o ruim|péssimo|terrível|horrível)\b/i,
 dica: "Em vez de 'péssimo', tente descrever o que aconteceu: 'Aconteceu X e eu me senti Y'. Isso ajuda as pessoas a entenderem você melhor!" }
];

/* ── INIT ──────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async function () {

 /* 1. Verifica sessão Supabase */
 const { data: { session } } = await supabaseClient.auth.getSession();
 if (!session) { window.location.href = "login.html"; return; }

 _userId = session.user.id;

 /* 2. Busca perfil geral */
 const { data: profileData, error: errProfile } = await supabaseClient
 .from('profiles')
 .select('nome, sobrenome, tipo')
 .eq('id', _userId)
 .single();

 if (errProfile || !profileData) { window.location.href = "login.html"; return; }

 /* Só adolescentes ficam aqui */
 if (profileData.tipo === 'responsavel') {
 window.location.href = "home-cuidador.html"; return;
 }

 /* 3. Busca dados extras (xp, nivel, codigo_vinculo, id_responsavel) */
 const { data: ndData } = await supabaseClient
 .from('neurodivergente')
 .select('xp, nivel, codigo_vinculo, id_responsavel')
 .eq('id', _userId)
 .single();

 _perfil = {
 nome: profileData.nome,
 sobrenome: profileData.sobrenome,
 xp: ndData?.xp ?? 0,
 nivel: ndData?.nivel ?? 1,
 codigoVinculo: ndData?.codigo_vinculo ?? null,
 idResponsavel: ndData?.id_responsavel ?? null,
 };

 /* 4. Preenche UI */
 var nome = _perfil.nome || "amigo";
 var elName = document.getElementById("nav-user-name");
 if (elName) elName.textContent = nome;
 var elSideName = document.getElementById("sidebar-name");
 if (elSideName) elSideName.textContent = nome;
 var elGreet = document.getElementById("greeting-name");
 if (elGreet) elGreet.textContent = nome.split(" ")[0];

 /* 5. XP */
 _atualizarXP();

 /* 6. Vínculo */
 _verificarVinculo();

 /* 7. Boas-vindas no chat */
 setTimeout(_benvindo, 400);

 /* 8. Eventos do textarea */
 var ta = document.getElementById("chat-ta");
 if (ta) {
 ta.addEventListener("input", function () {
 ta.style.height = "auto";
 ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
 document.getElementById("btn-send").disabled = !ta.value.trim();
 });
 ta.addEventListener("keydown", function (e) {
 if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
 });
 }
});

/* ── XP UI ─────────────────────────────────────────────────────── */
function _xpParaProximoNivel(xp) {
 var NIVEL_XP = [0,100,250,450,700,1000,1400,1900,2500,3200,4000];
 var nivel = 1;
 for (var i = NIVEL_XP.length - 1; i >= 0; i--) {
 if (xp >= NIVEL_XP[i]) { nivel = i + 1; break; }
 }
 if (nivel >= NIVEL_XP.length) return { nivel, atual: xp, proximo: xp, pct: 100 };
 var base = NIVEL_XP[nivel - 1];
 var next = NIVEL_XP[nivel];
 return { nivel, atual: xp - base, proximo: next - base, pct: Math.round((xp - base) / (next - base) * 100) };
}

function _atualizarXP() {
 if (!_perfil) return;
 var xp = _perfil.xp || 0;
 var nivel = _perfil.nivel || 1;
 var prox = _xpParaProximoNivel(xp);
 var elNivel = document.getElementById("xp-nivel");
 var elInfo = document.getElementById("xp-info");
 var elBar = document.getElementById("xp-bar");
 if (elNivel) elNivel.textContent = nivel;
 if (elInfo) elInfo.textContent = prox.atual + " / " + prox.proximo + " XP";
 if (elBar) elBar.style.width = Math.min(prox.pct, 100) + "%";
}

/* ── VÍNCULO COM CUIDADOR ──────────────────────────────────────── */
function _verificarVinculo() {
 if (!_perfil) return;
 var codigo = _perfil.codigoVinculo;
 var elCodigo = document.getElementById("meu-codigo");
 if (elCodigo) elCodigo.textContent = codigo || "------";

 if (_perfil.idResponsavel) {
 /* Vínculo ativo */
 var elCod = document.getElementById("meu-codigo");
 if (elCod && elCod.parentElement) elCod.parentElement.style.display = "none";
 var elAtivo = document.getElementById("vinculo-ativo-teen");
 if (elAtivo) elAtivo.style.display = "block";
 }
}

function copiarCodigoVinculo() {
 var el = document.getElementById("meu-codigo");
 if (!el || el.textContent === "------") return;
 navigator.clipboard.writeText(el.textContent).then(function () {
 el.textContent = "Copiado!";
 setTimeout(function () { el.textContent = _perfil.codigoVinculo || "------"; }, 1500);
 });
}

async function aceitarVinculoTeen() {
 var inp = document.getElementById("inp-cod-cuidador");
 var err = document.getElementById("err-vinculo-teen");
 var codigo = (inp.value || "").trim().toUpperCase();

 if (!codigo || codigo.length < 4) { err.classList.add("on"); return; }
 err.classList.remove("on");

 /* Chama a função Supabase que processa o vínculo */
 const { data, error } = await supabaseClient.rpc('aceitar_vinculo', { p_codigo: codigo });

 if (error || data !== 'ok') {
 var msg = data === 'codigo_invalido' ? 'Código inválido.'
 : data === 'ja_vinculado' ? 'Este adolescente já tem um cuidador.'
 : 'Erro ao vincular. Tente novamente.';
 err.textContent = msg;
 err.classList.add("on");
 return;
 }

 /* Atualiza UI */
 var elCod = document.getElementById("meu-codigo");
 if (elCod && elCod.parentElement) elCod.parentElement.style.display = "none";
 var elAtivo = document.getElementById("vinculo-ativo-teen");
 if (elAtivo) elAtivo.style.display = "block";
}

/* ── CHAT — MENSAGENS ──────────────────────────────────────────── */
function _renderMsg(role, texto) {
 var cont = document.getElementById("chat-msgs");
 if (!cont) return;

 var row = document.createElement("div");
 row.className = "msg-row " + (role === "user" ? "user" : "lumi");

 if (role !== "user") {
 var av = document.createElement("div");
 av.className = "msg-av";
 av.innerHTML = '<img src="img/urso-estrelhinha.png" alt="Lumi">';
 row.appendChild(av);
 }

 var wrap = document.createElement("div");
 wrap.style.display = "flex";
 wrap.style.flexDirection = "column";
 wrap.style.alignItems = role === "user" ? "flex-end" : "flex-start";

 var bubble = document.createElement("div");
 bubble.className = "msg-bubble";
 bubble.textContent = texto;

 var time = document.createElement("div");
 time.className = "msg-time";
 var now = new Date();
 time.textContent = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");

 wrap.appendChild(bubble);
 wrap.appendChild(time);
 row.appendChild(wrap);
 cont.appendChild(row);
 cont.scrollTop = cont.scrollHeight;
}

function _mostrarTyping() {
 var cont = document.getElementById("chat-msgs");
 if (!cont || document.getElementById("typing-indicator")) return;
 var row = document.createElement("div");
 row.className = "msg-row lumi";
 row.id = "typing-indicator";

 var av = document.createElement("div");
 av.className = "msg-av";
 av.innerHTML = '<img src="img/urso-estrelhinha.png" alt="Lumi">';

 var bubble = document.createElement("div");
 bubble.className = "msg-bubble msg-typing";
 bubble.innerHTML = '<span></span><span></span><span></span>';

 row.appendChild(av);
 row.appendChild(bubble);
 cont.appendChild(row);
 cont.scrollTop = cont.scrollHeight;
}

function _esconderTyping() {
 var el = document.getElementById("typing-indicator");
 if (el) el.remove();
}

function _benvindo() {
 var nome = (_perfil && _perfil.nome) ? _perfil.nome.split(" ")[0] : "amigo";
 _renderMsg("assistant", "Oi, " + nome + "! Estou aqui pra te ouvir. Como você está se sentindo hoje?");
}

/* ── URSO PROFESSOR ────────────────────────────────────────────── */
function _checarUrso(texto) {
 for (var i = 0; i < PADROES_URSO.length; i++) {
 if (PADROES_URSO[i].re.test(texto)) {
 _mostrarBearTip(PADROES_URSO[i].dica);
 return;
 }
 }
}

function _mostrarBearTip(texto) {
 var el = document.getElementById("bear-tip-text");
 var overlay = document.getElementById("bear-tip-overlay");
 if (!el || !overlay) return;
 el.textContent = texto;
 overlay.style.display = "block";
 if (_tipTimeout) clearTimeout(_tipTimeout);
 _tipTimeout = setTimeout(fecharBearTip, 8000);
}

function fecharBearTip() {
 var overlay = document.getElementById("bear-tip-overlay");
 if (overlay) overlay.style.display = "none";
}

/* ── ENVIAR MENSAGEM ───────────────────────────────────────────── */
async function enviarMensagem() {
 if (_carregando) return;
 var ta = document.getElementById("chat-ta");
 if (!ta) return;
 var texto = ta.value.trim();
 if (!texto) return;

 ta.value = "";
 ta.style.height = "auto";
 document.getElementById("btn-send").disabled = true;

 /* Oculta pills */
 var pills = document.getElementById("chat-pills");
 if (pills) pills.style.display = "none";

 _renderMsg("user", texto);
 _historico.push({ role: "user", content: texto });
 _checarUrso(texto);

 _carregando = true;
 _mostrarTyping();

 try {
 var resposta = await LumiIA.responder(_historico, null, _perfil);
 _esconderTyping();

 if (resposta && resposta.texto) {
 _renderMsg("assistant", resposta.texto);
 _historico.push({ role: "assistant", content: resposta.texto });

 /* Salva conversa no Supabase */
 if (_userId) {
   try {
     await supabaseClient.from('conversas').insert([
       { id_neurodivergente: _userId, role: 'user', content: texto, timestamp: new Date().toISOString() },
       { id_neurodivergente: _userId, role: 'assistant', content: resposta.texto, timestamp: new Date().toISOString() }
     ]);
   } catch(e) { console.warn('[LumiTEA] Erro ao salvar conversa:', e.message); }
 }

 /* Salva XP no Supabase */
 if (_userId) {
 var novoXp = (_perfil.xp || 0) + 10;
 var novoNivel = (_perfil.nivel || 1);
 var NIVEL_XP = [0,100,250,450,700,1000,1400,1900,2500,3200,4000];
 for (var i = NIVEL_XP.length - 1; i >= 0; i--) {
 if (novoXp >= NIVEL_XP[i]) { novoNivel = i + 1; break; }
 }
 await supabaseClient
 .from('neurodivergente')
 .update({ xp: novoXp, nivel: novoNivel })
 .eq('id', _userId);
 _perfil.xp = novoXp;
 _perfil.nivel = novoNivel;
 _atualizarXP();
 }
 }
 } catch (e) {
 _esconderTyping();
 _renderMsg("assistant", "Ops! Tive um probleminha de conexão. Pode tentar de novo? ");
 }

 _carregando = false;
}

/* ── MICROFONE ─────────────────────────────────────────────────── */
function toggleMic() {
 if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
 alert("Seu navegador não suporta reconhecimento de voz. Tente o Google Chrome.");
 return;
 }
 if (_micAtivo) { _pararMic(); return; }

 var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
 _reconhecimento = new Rec();
 _reconhecimento.lang = "pt-BR";
 _reconhecimento.continuous = false;
 _reconhecimento.interimResults = false;

 _reconhecimento.onresult = function (e) {
 var texto = e.results[0][0].transcript;
 var ta = document.getElementById("chat-ta");
 if (ta) {
 ta.value = (ta.value + " " + texto).trim();
 ta.style.height = "auto";
 ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
 document.getElementById("btn-send").disabled = !ta.value.trim();
 }
 _pararMic();
 };
 _reconhecimento.onerror = function () { _pararMic(); };
 _reconhecimento.onend = function () { _pararMic(); };
 _reconhecimento.start();
 _micAtivo = true;

 var btnMic = document.getElementById("btn-mic");
 var btnMicB = document.getElementById("btn-mic-bottom");
 if (btnMic) btnMic.classList.add("mic-active");
 if (btnMicB) btnMicB.classList.add("mic-active");
}

function _pararMic() {
 _micAtivo = false;
 if (_reconhecimento) { try { _reconhecimento.stop(); } catch(e) {} }
 var btnMic = document.getElementById("btn-mic");
 var btnMicB = document.getElementById("btn-mic-bottom");
 if (btnMic) btnMic.classList.remove("mic-active");
 if (btnMicB) btnMicB.classList.remove("mic-active");
}

/* ── PILLS ─────────────────────────────────────────────────────── */
function usarPill(btn) {
 var ta = document.getElementById("chat-ta");
 if (ta) {
 ta.value = btn.textContent.replace(/||/g, "").trim();
 document.getElementById("btn-send").disabled = false;
 ta.focus();
 }
}

/* ── FOCUS NO CHAT ─────────────────────────────────────────────── */
function focarNoChat() {
 var chat = document.getElementById("chat-panel");
 if (chat) chat.scrollIntoView({ behavior: "smooth" });
 setTimeout(function () {
 var ta = document.getElementById("chat-ta");
 if (ta) ta.focus();
 }, 400);
}

/* ── MASCOTE MODAL ─────────────────────────────────────────────── */
function abrirMascoteModal() {
 var m = document.getElementById("mascote-modal");
 if (m) m.style.display = "flex";
}
function fecharMascoteModal() {
 var m = document.getElementById("mascote-modal");
 if (m) m.style.display = "none";
}

/* ── LOGOUT ────────────────────────────────────────────────────── */
async function sairDaConta() {
 await supabaseClient.auth.signOut();
 window.location.href = "login.html";
}