/* =============================================================
   LUMITEA — login.js
   Autenticação via Supabase Auth
   ============================================================= */

/* supabaseClient já está definido no HTML (login.html) */

/* =============================================================
   MAPEAMENTO DE TIPO → PÁGINA
   ============================================================= */
const ROTAS_TIPO = {
  neurodivergente: 'home-autista.html',
  responsavel:     'home-cuidador.html',
  terapeuta:       'home-cuidador.html',  /* compatibilidade */
  psicologo:       'home-psicologo.html',
  crianca:         'home-autista.html',   /* compatibilidade com registros antigos */
};

/* =============================================================
   DOM
   ============================================================= */
const form       = document.getElementById('form-login');
const senhaInput = document.getElementById('senha');
const toggleBtn  = document.getElementById('toggle-senha');
const btnSubmit  = form.querySelector('.btn-submit');

/* =============================================================
   MOSTRAR / OCULTAR SENHA
   ============================================================= */
toggleBtn.addEventListener('click', () => {
  const visivel       = senhaInput.type === 'password';
  senhaInput.type     = visivel ? 'text' : 'password';
  toggleBtn.style.opacity = visivel ? '1' : '0.5';
});

/* =============================================================
   HELPERS
   ============================================================= */
function validarCampo(campoId, erroId, invalido) {
  const campo = document.getElementById(campoId);
  const erro  = document.getElementById(erroId);
  if (invalido) {
    erro.style.display      = 'block';
    campo.style.borderColor = 'var(--error)';
    return false;
  }
  erro.style.display      = 'none';
  campo.style.borderColor = 'var(--border)';
  return true;
}

function mostrarErroGeral(msg) {
  let el = document.getElementById('erro-geral');
  if (!el) {
    el = document.createElement('p');
    el.id        = 'erro-geral';
    el.className = 'erro-geral-msg';
    btnSubmit.parentNode.insertBefore(el, btnSubmit);
  }
  el.textContent   = msg;
  el.style.display = 'block';
}

function ocultarErroGeral() {
  const el = document.getElementById('erro-geral');
  if (el) el.style.display = 'none';
}

/* E-mail ainda não confirmado: em vez do erro genérico, oferece reenviar a
   confirmação sem precisar voltar pro cadastro. */
function mostrarErroConfirmacaoPendente(email) {
  ocultarErroGeral();
  let el = document.getElementById('erro-geral');
  if (!el) {
    el = document.createElement('p');
    el.id        = 'erro-geral';
    el.className = 'erro-geral-msg';
    btnSubmit.parentNode.insertBefore(el, btnSubmit);
  }
  el.textContent   = '';
  el.style.display = 'block';
  el.append('Você ainda não confirmou seu e-mail. Confira sua caixa de entrada (e o spam) ou ');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'field-link';
  btn.textContent = 'reenviar o e-mail de confirmação';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Reenviando...';
    try {
      const { error } = await supabaseClient.auth.resend({ type: 'signup', email });
      el.textContent = '';
      el.append(error ? 'Não foi possível reenviar agora. Tente de novo em instantes.' : 'E-mail reenviado! Confira sua caixa de entrada.');
    } catch (e) {
      el.textContent = 'Não foi possível reenviar agora. Tente de novo em instantes.';
    }
  });
  el.append('.');
  el.append(document.createElement('br'));
  el.append(btn);
}

/* =============================================================
   ENVIO DO FORMULÁRIO — usa Supabase Auth
   ============================================================= */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarErroGeral();

  const identificador = document.getElementById('identificador').value.trim();
  const senha = senhaInput.value;

  let valido = true;
  if (!validarCampo('identificador', 'identificador-error', !identificador)) valido = false;
  if (!validarCampo('senha', 'senha-error', !senha))                         valido = false;
  if (!valido) return;

  btnSubmit.disabled    = true;
  btnSubmit.textContent = 'Entrando...';

  try {
    /* 1. Descobre o e-mail de login.
       - Se digitou um e-mail (tem "@"), usa direto.
       - Se digitou um celular, troca o número pelo e-mail via RPC. */
    let email = identificador;
    if (!identificador.includes('@')) {
      const celular = identificador.replace(/\D/g, '');
      if (celular.length < 10) {
        mostrarErroGeral('Informe um celular válido (com DDD) ou seu e-mail.');
        btnSubmit.disabled = false; btnSubmit.textContent = 'Entrar na minha conta';
        return;
      }
      try {
        const { data: emailDoTel, error: errTel } = await supabaseClient.rpc('email_por_telefone', { tel: celular });
        if (errTel || !emailDoTel) {
          mostrarErroGeral('Não encontramos uma conta com esse celular. Verifique o número ou entre com o e-mail.');
          btnSubmit.disabled = false; btnSubmit.textContent = 'Entrar na minha conta';
          return;
        }
        email = emailDoTel;
      } catch (e) {
        mostrarErroGeral('Não foi possível verificar o celular agora. Tente com o e-mail.');
        btnSubmit.disabled = false; btnSubmit.textContent = 'Entrar na minha conta';
        return;
      }
    }

    /* 2. Autentica via Supabase Auth */
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      /* GoTrue devolve essa mensagem específica quando a conta existe e a
         senha está certa, mas o e-mail ainda não foi confirmado — mostrar
         "senha incorreta" nesse caso confundiria quem já fez tudo certo. */
      const semConfirmar = (error.message || '').toLowerCase().indexOf('email not confirmed') !== -1
        || error.code === 'email_not_confirmed';
      if (semConfirmar) {
        mostrarErroConfirmacaoPendente(email);
      } else {
        mostrarErroGeral('Celular/e-mail ou senha incorretos.');
      }
      btnSubmit.disabled    = false;
      btnSubmit.textContent = 'Entrar na minha conta';
      return;
    }

    /* 2. Busca o tipo do usuário na tabela profiles */
    const userId = data.user.id;
    const { data: perfil, error: errPerfil } = await supabaseClient
      .from('profiles')
      .select('tipo')
      .eq('id', userId)
      .single();

    if (errPerfil || !perfil) {
      mostrarErroGeral('Não foi possível carregar seu perfil. Tente novamente.');
      await supabaseClient.auth.signOut();
      btnSubmit.disabled    = false;
      btnSubmit.textContent = 'Entrar na minha conta';
      return;
    }

    /* 3. Redireciona conforme o tipo */
    const pagina = ROTAS_TIPO[perfil.tipo] || 'index.html';
    window.location.href = pagina;

  } catch (err) {
    mostrarErroGeral('Não foi possível conectar. Verifique sua conexão.');
    btnSubmit.disabled    = false;
    btnSubmit.textContent = 'Entrar na minha conta';
  }
});