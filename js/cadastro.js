/* =============================================================
 LUMITEA — cadastro.js
 Cadastro via Supabase Auth (signUp) + tabela profiles
 ============================================================= */

/* supabaseClient já está definido no HTML (cadastro.html) */

/* =============================================================
 MAPEAMENTO DE TIPO → PÁGINA
 ============================================================= */
 const ROTAS_TIPO = {
 neurodivergente: 'home-autista.html',
 responsavel: 'home-cuidador.html',
 terapeuta: 'home-cuidador.html',
 psicologo: 'home-psicologo.html',
 };
 
 /* =============================================================
 DOM
 ============================================================= */
 const form = document.getElementById('form-cadastro');
 const senhaInput = document.getElementById('senha');
 const confirmarInput = document.getElementById('confirmar-senha');
 const toggleSenha = document.getElementById('toggle-senha');
 const toggleConfirmar = document.getElementById('toggle-confirmar');
 const strengthWrap = document.getElementById('password-strength');
 const strengthLabel = document.getElementById('strength-label');
 const bars = [
 document.getElementById('bar-1'),
 document.getElementById('bar-2'),
 document.getElementById('bar-3'),
 ];
 const btnSubmit = document.getElementById('btn-submit');

 /* Data de nascimento: limite superior = hoje (ninguém nasce no futuro).
    Fica no JS porque um `max` fixo no HTML envelhece. */
 const nascimentoInput = document.getElementById('nascimento');
 if (nascimentoInput) {
 const hoje = new Date();
 nascimentoInput.max = hoje.getFullYear() + '-' +
 String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
 String(hoje.getDate()).padStart(2, '0');
 }

 /* `!nascimento` sozinho não basta: um ano de 6 dígitos (275760) é uma data
    VÁLIDA para o input, então `.value` vem preenchido e passava direto. Foi
    assim que entraram duas datas impossíveis no banco. */
 function nascimentoInvalido() {
 const el = document.getElementById('nascimento');
 if (!el) return false;
 if (!el.value) return true;
 const v = el.validity;
 return v.badInput || v.rangeUnderflow || v.rangeOverflow || !/^\d{4}-\d{2}-\d{2}$/.test(el.value);
 }

 /* =============================================================
 NAVEGAÇÃO ENTRE ETAPAS (STEPPER)
 ============================================================= */
 const TOTAL_ETAPAS = 3;
 let etapaAtual = 1;

 function validarEtapa(etapa) {
 let ok = true;
 if (etapa === 1) {
 const nome = document.getElementById('nome').value.trim();
 const sobrenome = document.getElementById('sobrenome').value.trim();
 const email = document.getElementById('email').value.trim();
 const celular = soDigitos(document.getElementById('celular').value);
 if (!validarCampo('nome', 'nome-error', !nome)) ok = false;
 if (!validarCampo('sobrenome', 'sobrenome-error', !sobrenome)) ok = false;
 if (!validarCampo('email', 'email-error', !email || !email.includes('@'))) ok = false;
 if (!validarCampo('celular', 'celular-error', celular.length < 10 || celular.length > 13)) ok = false;
 } else if (etapa === 2) {
 const tipo = document.getElementById('tipo').value;
 if (!validarCampo('nascimento', 'nascimento-error', nascimentoInvalido())) ok = false;
 if (!validarCampo('tipo', 'tipo-error', !tipo)) ok = false;
 if (tipo === 'psicologo') {
 const crp = document.getElementById('crp').value.trim();
 if (!validarCampo('crp', 'crp-error', !crp)) ok = false;
 }
 }
 return ok;
 }

 /* Campo de CRP só existe pra quem escolhe "psicólogo(a)" — mostra/esconde
    junto com a troca do select, em vez de deixar um campo vazio e confuso
    pros outros tipos de conta. */
 const tipoSelect = document.getElementById('tipo');
 const grupoCrp = document.getElementById('grupo-crp');
 tipoSelect.addEventListener('change', () => {
 const ehPsicologo = tipoSelect.value === 'psicologo';
 grupoCrp.hidden = !ehPsicologo;
 if (!ehPsicologo) validarCampo('crp', 'crp-error', false);
 });

 function irParaEtapa(etapa) {
 /* Painéis */
 for (let i = 1; i <= TOTAL_ETAPAS; i++) {
 document.getElementById('panel-' + i).classList.toggle('active', i === etapa);
 }
 /* Círculos e itens do stepper */
 for (let i = 1; i <= TOTAL_ETAPAS; i++) {
 const item = document.getElementById('step-item-' + i);
 const circle = document.getElementById('step-circle-' + i);
 item.classList.remove('active', 'done');
 circle.classList.remove('active', 'done');
 if (i < etapa) {
 item.classList.add('done');
 circle.classList.add('done');
 } else if (i === etapa) {
 item.classList.add('active');
 circle.classList.add('active');
 }
 }
 /* Linhas entre os círculos */
 for (let i = 1; i < TOTAL_ETAPAS; i++) {
 document.getElementById('step-line-' + i).classList.toggle('done', i < etapa);
 }

 etapaAtual = etapa;

 /* Foco no primeiro campo da etapa */
 const primeiro = document.getElementById('panel-' + etapa).querySelector('input, select');
 if (primeiro) primeiro.focus();
 }

 document.getElementById('btn-next-1').addEventListener('click', () => {
 if (validarEtapa(1)) irParaEtapa(2);
 });
 document.getElementById('btn-next-2').addEventListener('click', () => {
 if (validarEtapa(2)) irParaEtapa(3);
 });
 document.getElementById('btn-back-2').addEventListener('click', () => irParaEtapa(1));
 document.getElementById('btn-back-3').addEventListener('click', () => irParaEtapa(2));

 /* =============================================================
 MOSTRAR / OCULTAR SENHA
 ============================================================= */
 toggleSenha.addEventListener('click', () => {
 const v = senhaInput.type === 'password';
 senhaInput.type = v ? 'text' : 'password';
 toggleSenha.style.opacity = v ? '1' : '0.5';
 });
 
 toggleConfirmar.addEventListener('click', () => {
 const v = confirmarInput.type === 'password';
 confirmarInput.type = v ? 'text' : 'password';
 toggleConfirmar.style.opacity = v ? '1' : '0.5';
 });
 
 /* =============================================================
 INDICADOR DE FORÇA DA SENHA
 ============================================================= */
 senhaInput.addEventListener('input', () => {
 const val = senhaInput.value;
 strengthWrap.style.display = val.length > 0 ? 'flex' : 'none';
 
 let score = 0;
 if (val.length >= 6) score++;
 if (val.length >= 10) score++;
 if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val)) score++;
 
 bars.forEach(b => { b.className = 'strength-bar'; });
 
 if (score === 1) {
 bars[0].classList.add('weak');
 strengthLabel.textContent = 'Fraca';
 strengthLabel.className = 'strength-label weak';
 } else if (score === 2) {
 bars[0].classList.add('medium');
 bars[1].classList.add('medium');
 strengthLabel.textContent = 'Média';
 strengthLabel.className = 'strength-label medium';
 } else if (score >= 3) {
 bars.forEach(b => b.classList.add('strong'));
 strengthLabel.textContent = 'Forte';
 strengthLabel.className = 'strength-label strong';
 }
 });
 
 /* =============================================================
 HELPERS
 ============================================================= */
 /* Normaliza telefone: mantém só dígitos */
 function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }

 function validarCampo(campoId, erroId, invalido) {
 const campo = document.getElementById(campoId);
 const erro = document.getElementById(erroId);
 if (invalido) {
 erro.style.display = 'block';
 campo.style.borderColor = 'var(--error)';
 return false;
 }
 erro.style.display = 'none';
 campo.style.borderColor = 'var(--border)';
 return true;
 }
 
 function mostrarErroGeral(msg) {
 let el = document.getElementById('erro-geral');
 if (!el) {
 el = document.createElement('p');
 el.id = 'erro-geral';
 el.className = 'erro-geral-msg';
 btnSubmit.parentNode.insertBefore(el, btnSubmit);
 }
 el.textContent = msg;
 el.style.display = 'block';
 }
 
 function ocultarErroGeral() {
 const el = document.getElementById('erro-geral');
 if (el) el.style.display = 'none';
 }
 
 /* =============================================================
 ENVIO DO FORMULÁRIO
 ============================================================= */
 form.addEventListener('submit', async (e) => {
 e.preventDefault();
 ocultarErroGeral();
 
 const nome = document.getElementById('nome').value.trim();
 const sobrenome = document.getElementById('sobrenome').value.trim();
 const email = document.getElementById('email').value.trim();
 const celular = soDigitos(document.getElementById('celular').value);
 const nascimento = document.getElementById('nascimento').value;
 const tipo = document.getElementById('tipo').value;
 const crp = document.getElementById('crp').value.trim();
 const senha = senhaInput.value;
 const confirma = confirmarInput.value;
 const termos = document.getElementById('termos');
 const termosErr = document.getElementById('termos-error');

 /* Validação */
 let valido = true;
 if (!validarCampo('nome', 'nome-error', !nome)) valido = false;
 if (!validarCampo('sobrenome', 'sobrenome-error', !sobrenome)) valido = false;
 if (!validarCampo('email', 'email-error', !email || !email.includes('@'))) valido = false;
 if (!validarCampo('celular', 'celular-error', celular.length < 10 || celular.length > 13)) valido = false;
 if (!validarCampo('nascimento', 'nascimento-error', nascimentoInvalido())) valido = false;
 if (!validarCampo('tipo', 'tipo-error', !tipo)) valido = false;
 if (tipo === 'psicologo' && !validarCampo('crp', 'crp-error', !crp)) valido = false;
 if (!validarCampo('senha', 'senha-error', senha.length < 6)) valido = false;
 if (!validarCampo('confirmar-senha','confirmar-senha-error', senha !== confirma || !confirma)) valido = false;
 
 if (!termos.checked) {
 termosErr.style.display = 'block';
 valido = false;
 } else {
 termosErr.style.display = 'none';
 }
 
 if (!valido) return;
 
 btnSubmit.disabled = true;
 btnSubmit.textContent = 'Criando conta...';
 
 try {
 /* Normaliza: 'neurodivergente' e 'psicologo' passam direto; qualquer
    outra opção (inclusive 'terapeuta', hoje decorativa) vira 'responsavel',
    que é o tipo real do painel do cuidador. */
 const tipoNormalizado = tipo === 'neurodivergente' ? 'neurodivergente'
   : tipo === 'psicologo' ? 'psicologo'
   : 'responsavel';

 /* 0. Checa se o celular já está em uso (evita conta duplicada).
 Se a função ainda não existir no banco, ignora e segue. */
 try {
 const { data: jaExiste } = await supabaseClient.rpc('telefone_existe', { tel: celular });
 if (jaExiste === true) {
 mostrarErroGeral('Este celular já está cadastrado. Tente entrar com ele.');
 btnSubmit.disabled = false;
 btnSubmit.textContent = 'Criar minha conta gratuita';
 return;
 }
 } catch (e) { /* função opcional — segue sem bloquear */ }

 /* 1. Cria o usuário no Supabase Auth
 Os metadados são lidos pelo trigger handle_new_user() */
 const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
 email,
 password: senha,
 options: {
 data: {
 nome,
 sobrenome,
 tipo: tipoNormalizado,
 nascimento,
 telefone: celular,
 crp: tipoNormalizado === 'psicologo' ? crp : undefined,
 perfil: tipoNormalizado === 'neurodivergente' ? 'Adolescente'
   : tipoNormalizado === 'psicologo' ? 'Psicólogo(a)'
   : 'Responsável',
 },
 },
 });
 
 if (signUpError) {
 const msgLower = (signUpError.message || '').toLowerCase();
 if (
 msgLower.includes('already registered') ||
 msgLower.includes('user already registered') ||
 msgLower.includes('email address is already')
 ) {
 mostrarErroGeral('Este e-mail já está cadastrado.');
 } else {
 mostrarErroGeral(signUpError.message || 'Erro ao criar conta. Tente novamente.');
 }
 btnSubmit.disabled = false;
 btnSubmit.textContent = 'Criar minha conta gratuita';
 return;
 }
 
 /* 2. Verifica se a sessão foi criada imediatamente (confirmação de email OFF)
 Se não (confirmação ON), faz login manual para obter a sessão */
 let sessaoAtiva = !!signUpData.session;
 
 if (!sessaoAtiva) {
 /* Tenta login imediato — funciona se confirmação de email estiver OFF
 no Supabase (Authentication → Email → "Confirm email" → desativado) */
 const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
 email,
 password: senha,
 });
 
 if (!loginError && loginData.session) {
 sessaoAtiva = true;
 }
 }
 
 if (!sessaoAtiva) {
 /* Confirmação de email está ATIVADA e o usuário precisa confirmar antes.
 Orienta o usuário em vez de redirecionar para página protegida. */
 mostrarErroGeral(
 'Conta criada! Enviamos um e-mail de confirmação para ' + email + '. ' +
 'Confirme o cadastro pelo link e depois entre com o seu celular.'
 );
 btnSubmit.disabled = false;
 btnSubmit.textContent = 'Criar minha conta gratuita';
 return;
 }
 
 /* 3. Sessão ativa — redireciona para a página correta */
 const pagina = ROTAS_TIPO[tipoNormalizado] || 'login.html';
 window.location.href = pagina;
 
 } catch (err) {
 console.error('Erro no cadastro:', err);
 mostrarErroGeral('Não foi possível conectar. Verifique sua conexão.');
 btnSubmit.disabled = false;
 btnSubmit.textContent = 'Criar minha conta gratuita';
 }
 });
 
 /* =============================================================
 URSO MASCOTE COM SCROLL
 Inicio: topo do card (seta vermelha) -> fundo do card (seta amarela)
 ============================================================= */
 (function () {
 const bear = document.getElementById('bear-mascot');
 const card = document.querySelector('.account-card');
 const BREAKPOINT = 900;
 const BEAR_SIZE = 200;
 const VOLTAS = 2;
 let autoAngle = 0;
 let rafId = null;
 let pending = false;

 function isMobile() { return window.innerWidth <= BREAKPOINT; }
 function hasScrollRoom(){ return document.documentElement.scrollHeight > window.innerHeight + 10; }

 function spinLoop() {
 autoAngle = (autoAngle + 0.5) % 360;
 bear.style.transform = 'rotate(' + autoAngle + 'deg)';
 rafId = requestAnimationFrame(spinLoop);
 }
 function stopSpin() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

 function update() {
 pending = false;
 const scrollY = window.scrollY;
 const cardRect = card.getBoundingClientRect();

 /* Coordenadas absolutas do card no documento */
 const areaTop = cardRect.top + scrollY;
 const areaBottom = cardRect.bottom + scrollY - BEAR_SIZE;
 const areaHeight = areaBottom - areaTop;

 if (isMobile()) {
 // Clear JS-set positions so CSS media query (position:fixed) takes over
 bear.style.left = '';
 bear.style.top = '';
 stopSpin();
 const docScrollable = document.documentElement.scrollHeight - window.innerHeight;
 const progress = docScrollable > 0 ? Math.min(1, scrollY / docScrollable) : 0;
 bear.style.transform = 'rotate(' + (progress * 360 * VOLTAS) + 'deg)';
 } else {
 bear.style.left = (cardRect.right + window.scrollX + 24) + 'px';

 if (!hasScrollRoom()) {
 /* Sem scroll: fica no topo do card e gira sozinho */
 bear.style.top = areaTop + 'px';
 if (!rafId) spinLoop();
 } else {
 stopSpin();
 const docScrollable = document.documentElement.scrollHeight - window.innerHeight;
 const progress = Math.min(1, scrollY / docScrollable);
 /* Topo do card (scroll=0) ate fundo do card (scroll=max) */
 bear.style.top = (areaTop + progress * areaHeight) + 'px';
 bear.style.transform = 'rotate(' + (progress * 360 * VOLTAS) + 'deg)';
 }
 }
 }

 function onScroll() {
 if (!pending) { pending = true; requestAnimationFrame(update); }
 }

 window.addEventListener('scroll', onScroll, { passive: true });
 window.addEventListener('resize', () => { stopSpin(); pending = true; requestAnimationFrame(update); });
 requestAnimationFrame(update);
 })();