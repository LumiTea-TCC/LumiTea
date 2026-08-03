-- ============================================================
-- LumiTEA — SCHEMA COMPLETO
-- Versão: 3.0  (base v2.0 + comunidade + chat tempo real + login por celular)
--
-- ESTE É O ÚNICO ARQUIVO QUE VOCÊ PRECISA RODAR.
-- 100% idempotente: pode rodar de novo por cima de um banco existente.
-- Supabase → SQL Editor → cole tudo → RUN.
--
-- Diferenças importantes em relação ao seu v2.0:
--   • profiles ganha a coluna `telefone` (login por celular).
--   • As triggers de signup usam SET search_path = public + tratamento
--     de exceção (corrige o erro 500 "Database error saving new user").
--   • Tabelas novas: comunidade_posts/comentarios/apoios (mural),
--     comunidade_chat (chat em tempo real) + função meu_publico().
--   • RPCs novas: email_por_telefone(), telefone_existe().
--   • Todas as policies usam DROP ... IF EXISTS antes de CREATE,
--     então rodar o arquivo várias vezes não dá erro.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper de updated_at (usado por várias tabelas)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 1. PROFILES  (agora com telefone)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL DEFAULT '',
  sobrenome   TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL CHECK (tipo IN ('neurodivergente','responsavel','terapeuta')),
  telefone    TEXT,
  avatar_url  TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- garante a coluna em bancos que já tinham profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefone TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_telefone ON profiles(telefone);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_all" ON profiles;
CREATE POLICY "profiles_self_all" ON profiles
  FOR ALL USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_resp_read" ON profiles;
CREATE POLICY "profiles_resp_read" ON profiles
  FOR SELECT USING (
    id IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cria o perfil após o signup, lendo os metadados (inclui telefone).
-- SET search_path = public + EXCEPTION para o signup NUNCA quebrar.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sobrenome, tipo, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', ''),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'neurodivergente'),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'telefone', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user falhou para % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- 2. NEURODIVERGENTE
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS neurodivergente (
  id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp              INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  nivel           INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  codigo_vinculo  TEXT UNIQUE,
  id_responsavel  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nascimento      DATE,
  apelido         TEXT,
  nome_mascote    TEXT DEFAULT 'Lumi',
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nd_responsavel ON neurodivergente(id_responsavel);
CREATE INDEX IF NOT EXISTS idx_nd_codigo      ON neurodivergente(codigo_vinculo);

ALTER TABLE neurodivergente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nd_self" ON neurodivergente;
CREATE POLICY "nd_self" ON neurodivergente FOR ALL USING (id = auth.uid());

DROP POLICY IF EXISTS "nd_responsavel" ON neurodivergente;
CREATE POLICY "nd_responsavel" ON neurodivergente FOR ALL USING (id_responsavel = auth.uid());

CREATE OR REPLACE FUNCTION criar_neurodivergente()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'neurodivergente' THEN
    INSERT INTO public.neurodivergente (id, codigo_vinculo)
    VALUES (NEW.id, upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'criar_neurodivergente falhou para % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION criar_neurodivergente();


-- ══════════════════════════════════════════════════════════════
-- 3. PREFERENCIAS_USUARIO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS preferencias_usuario (
  id_neurodivergente UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  sugestoes          BOOLEAN DEFAULT true,
  urso               BOOLEAN DEFAULT true,
  anim               BOOLEAN DEFAULT true,
  lembrete           BOOLEAN DEFAULT false,
  fonte              TEXT DEFAULT 'normal' CHECK (fonte IN ('normal','grande','muito-grande')),
  tema               TEXT DEFAULT 'auto'   CHECK (tema   IN ('auto','claro','escuro')),
  "reduzAnim"        BOOLEAN DEFAULT false,
  alto_contraste     BOOLEAN DEFAULT false,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prefs_self" ON preferencias_usuario;
CREATE POLICY "prefs_self" ON preferencias_usuario FOR ALL USING (id_neurodivergente = auth.uid());

DROP TRIGGER IF EXISTS prefs_updated_at ON preferencias_usuario;
CREATE TRIGGER prefs_updated_at
  BEFORE UPDATE ON preferencias_usuario
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION criar_preferencias_padrao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'neurodivergente' THEN
    INSERT INTO public.preferencias_usuario (id_neurodivergente)
    VALUES (NEW.id)
    ON CONFLICT (id_neurodivergente) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'criar_preferencias_padrao falhou para % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_prefs ON profiles;
CREATE TRIGGER on_profile_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION criar_preferencias_padrao();


-- ══════════════════════════════════════════════════════════════
-- 4. MEMORIA_LUMI
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memoria_lumi (
  id_neurodivergente UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  fatos              JSONB DEFAULT '[]'::jsonb,
  resumo             TEXT DEFAULT '',
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE memoria_lumi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memoria_self" ON memoria_lumi;
CREATE POLICY "memoria_self" ON memoria_lumi FOR ALL USING (id_neurodivergente = auth.uid());

DROP POLICY IF EXISTS "memoria_resp_read" ON memoria_lumi;
CREATE POLICY "memoria_resp_read" ON memoria_lumi
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );

DROP TRIGGER IF EXISTS memoria_updated_at ON memoria_lumi;
CREATE TRIGGER memoria_updated_at
  BEFORE UPDATE ON memoria_lumi
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 5. CONVERSAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content            TEXT NOT NULL,
  metadata           JSONB DEFAULT '{}'::jsonb,
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_teen ON conversas(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_conv_ts   ON conversas(timestamp DESC);

ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_self" ON conversas;
CREATE POLICY "conv_self" ON conversas FOR ALL USING (id_neurodivergente = auth.uid());

DROP POLICY IF EXISTS "conv_resp_read" ON conversas;
CREATE POLICY "conv_resp_read" ON conversas
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 6. HUMORES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS humores (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nivel              INTEGER NOT NULL CHECK (nivel BETWEEN 0 AND 5),
  nota               TEXT,
  emoji              TEXT,
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_humores_teen ON humores(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_humores_ts   ON humores(timestamp DESC);

ALTER TABLE humores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "humores_self_read" ON humores;
CREATE POLICY "humores_self_read" ON humores FOR SELECT USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "humores_self_insert" ON humores;
CREATE POLICY "humores_self_insert" ON humores FOR INSERT WITH CHECK (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "humores_self_update" ON humores;
CREATE POLICY "humores_self_update" ON humores FOR UPDATE USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "humores_resp_read" ON humores;
CREATE POLICY "humores_resp_read" ON humores
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 7. DIARIO_ENTRADAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS diario_entradas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo             TEXT,
  texto              TEXT NOT NULL,
  humor              TEXT DEFAULT 'mais-ou-menos',
  emoji              TEXT DEFAULT '📝',
  reflexao_lumi      TEXT,
  is_privado         BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diario_teen ON diario_entradas(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_diario_ts   ON diario_entradas(created_at DESC);

ALTER TABLE diario_entradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diario_self" ON diario_entradas;
CREATE POLICY "diario_self" ON diario_entradas FOR ALL USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "diario_resp_read" ON diario_entradas;
CREATE POLICY "diario_resp_read" ON diario_entradas
  FOR SELECT USING (
    is_privado = false AND
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );

DROP TRIGGER IF EXISTS diario_updated_at ON diario_entradas;
CREATE TRIGGER diario_updated_at
  BEFORE UPDATE ON diario_entradas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 8. ALERTAS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS alertas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo               TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info','crise','aviso','conquista','lembrete')),
  titulo             TEXT NOT NULL,
  descricao          TEXT,
  emoji              TEXT DEFAULT '📌',
  lido               BOOLEAN DEFAULT false,
  destino            TEXT DEFAULT 'adolescente' CHECK (destino IN ('adolescente','responsavel','ambos')),
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alertas_teen ON alertas(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_alertas_ts   ON alertas(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido);
CREATE INDEX IF NOT EXISTS idx_alertas_dest ON alertas(destino);

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alertas_self" ON alertas;
CREATE POLICY "alertas_self" ON alertas FOR ALL USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "alertas_resp" ON alertas;
CREATE POLICY "alertas_resp" ON alertas
  FOR ALL USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 9. RELATORIOS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS relatorios (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resumo             TEXT,
  humor_geral        TEXT DEFAULT 'neutro' CHECK (humor_geral IN ('muito-bem','bem','neutro','mal','muito-mal')),
  pontos_atencao     JSONB DEFAULT '[]'::jsonb,
  dicas_cuidador     JSONB DEFAULT '[]'::jsonb,
  sugestoes          JSONB DEFAULT '[]'::jsonb,
  visao_psicologica  TEXT,
  nivel_crise        BOOLEAN DEFAULT false,
  periodo_inicio     TIMESTAMPTZ,
  periodo_fim        TIMESTAMPTZ,
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rel_teen ON relatorios(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_rel_ts   ON relatorios(timestamp DESC);

ALTER TABLE relatorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rel_self" ON relatorios;
CREATE POLICY "rel_self" ON relatorios FOR ALL USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "rel_resp" ON relatorios;
CREATE POLICY "rel_resp" ON relatorios
  FOR ALL USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 10. EVENTOS_CALENDARIO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id_cuidador         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  titulo              TEXT NOT NULL,
  data_evento         DATE NOT NULL,
  hora_evento         TIME,
  descricao           TEXT,
  cor                 TEXT DEFAULT '#7c5cbf',
  roleplay_prep       BOOLEAN DEFAULT false,
  origem              TEXT DEFAULT 'adolescente' CHECK (origem IN ('adolescente','responsavel','terapeuta')),
  timestamp           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eventos_teen ON eventos_calendario(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos_calendario(data_evento);

ALTER TABLE eventos_calendario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_teen" ON eventos_calendario;
CREATE POLICY "eventos_teen" ON eventos_calendario
  FOR ALL USING (id_neurodivergente = auth.uid() OR id_cuidador = auth.uid());
DROP POLICY IF EXISTS "eventos_insert" ON eventos_calendario;
CREATE POLICY "eventos_insert" ON eventos_calendario
  FOR INSERT WITH CHECK (id_neurodivergente = auth.uid() OR id_cuidador = auth.uid());
DROP POLICY IF EXISTS "eventos_resp_read" ON eventos_calendario;
CREATE POLICY "eventos_resp_read" ON eventos_calendario
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 11. OBSERVACOES_CUIDADOR
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS observacoes_cuidador (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id_cuidador        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto              TEXT NOT NULL,
  visivel_terapeuta  BOOLEAN DEFAULT false,
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_obs_teen    ON observacoes_cuidador(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_obs_cuidad  ON observacoes_cuidador(id_cuidador);

ALTER TABLE observacoes_cuidador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obs_cuidador_own" ON observacoes_cuidador;
CREATE POLICY "obs_cuidador_own" ON observacoes_cuidador FOR ALL USING (id_cuidador = auth.uid());
DROP POLICY IF EXISTS "obs_terapeuta_read" ON observacoes_cuidador;
CREATE POLICY "obs_terapeuta_read" ON observacoes_cuidador
  FOR SELECT USING (
    visivel_terapeuta = true AND
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 12. CONQUISTAS_USUARIO
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conquistas_usuario (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conquista_id       TEXT NOT NULL,
  desbloqueada_em    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_neurodivergente, conquista_id)
);
CREATE INDEX IF NOT EXISTS idx_conq_teen ON conquistas_usuario(id_neurodivergente);

ALTER TABLE conquistas_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conquistas_self" ON conquistas_usuario;
CREATE POLICY "conquistas_self" ON conquistas_usuario FOR ALL USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "conquistas_resp_read" ON conquistas_usuario;
CREATE POLICY "conquistas_resp_read" ON conquistas_usuario
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- 13. SESSOES_ROLEPLAY
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessoes_roleplay (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cenario            TEXT NOT NULL,
  mensagens          JSONB DEFAULT '[]'::jsonb,
  avaliacao_lumi     TEXT,
  xp_ganho           INTEGER DEFAULT 0,
  concluido          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rp_teen ON sessoes_roleplay(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_rp_ts   ON sessoes_roleplay(created_at DESC);

ALTER TABLE sessoes_roleplay ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rp_self" ON sessoes_roleplay;
CREATE POLICY "rp_self" ON sessoes_roleplay FOR ALL USING (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS "rp_resp_read" ON sessoes_roleplay;
CREATE POLICY "rp_resp_read" ON sessoes_roleplay
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );

DROP TRIGGER IF EXISTS rp_updated_at ON sessoes_roleplay;
CREATE TRIGGER rp_updated_at
  BEFORE UPDATE ON sessoes_roleplay
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 14. COMUNIDADE — público do usuário (teen x cuidador)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.meu_publico()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tipo IN ('responsavel','terapeuta')
    ) THEN 'cuidador' ELSE 'teen'
  END;
$$;

-- ── 14a. MURAL (posts / comentários / apoios) ────────────────
CREATE TABLE IF NOT EXISTS comunidade_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL DEFAULT 'Alguém',
  publico    TEXT NOT NULL CHECK (publico IN ('teen','cuidador')),
  categoria  TEXT,
  texto      TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_com_posts_publico ON comunidade_posts (publico, criado_em DESC);
ALTER TABLE comunidade_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS com_posts_select ON comunidade_posts;
CREATE POLICY com_posts_select ON comunidade_posts FOR SELECT TO authenticated
  USING (publico = public.meu_publico());
DROP POLICY IF EXISTS com_posts_insert ON comunidade_posts;
CREATE POLICY com_posts_insert ON comunidade_posts FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND publico = public.meu_publico());
DROP POLICY IF EXISTS com_posts_delete ON comunidade_posts;
CREATE POLICY com_posts_delete ON comunidade_posts FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

CREATE TABLE IF NOT EXISTS comunidade_comentarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES comunidade_posts(id) ON DELETE CASCADE,
  autor_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL DEFAULT 'Alguém',
  texto      TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 1000),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_com_coment_post ON comunidade_comentarios (post_id, criado_em);
ALTER TABLE comunidade_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS com_coment_select ON comunidade_comentarios;
CREATE POLICY com_coment_select ON comunidade_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM comunidade_posts po WHERE po.id = post_id AND po.publico = public.meu_publico()));
DROP POLICY IF EXISTS com_coment_insert ON comunidade_comentarios;
CREATE POLICY com_coment_insert ON comunidade_comentarios FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM comunidade_posts po WHERE po.id = post_id AND po.publico = public.meu_publico()));
DROP POLICY IF EXISTS com_coment_delete ON comunidade_comentarios;
CREATE POLICY com_coment_delete ON comunidade_comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

CREATE TABLE IF NOT EXISTS comunidade_apoios (
  post_id   UUID NOT NULL REFERENCES comunidade_posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE comunidade_apoios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS com_apoios_select ON comunidade_apoios;
CREATE POLICY com_apoios_select ON comunidade_apoios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM comunidade_posts po WHERE po.id = post_id AND po.publico = public.meu_publico()));
DROP POLICY IF EXISTS com_apoios_insert ON comunidade_apoios;
CREATE POLICY com_apoios_insert ON comunidade_apoios FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM comunidade_posts po WHERE po.id = post_id AND po.publico = public.meu_publico()));
DROP POLICY IF EXISTS com_apoios_delete ON comunidade_apoios;
CREATE POLICY com_apoios_delete ON comunidade_apoios FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 14b. CHAT EM TEMPO REAL ──────────────────────────────────
CREATE TABLE IF NOT EXISTS comunidade_chat (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala       TEXT NOT NULL,
  publico    TEXT NOT NULL CHECK (publico IN ('teen','cuidador')),
  autor_id   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL DEFAULT 'Alguém',
  texto      TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 1000),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sala ON comunidade_chat (publico, sala, criado_em);
ALTER TABLE comunidade_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_select ON comunidade_chat;
CREATE POLICY chat_select ON comunidade_chat FOR SELECT TO authenticated
  USING (publico = public.meu_publico());
DROP POLICY IF EXISTS chat_insert ON comunidade_chat;
CREATE POLICY chat_insert ON comunidade_chat FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND publico = public.meu_publico());
DROP POLICY IF EXISTS chat_delete ON comunidade_chat;
CREATE POLICY chat_delete ON comunidade_chat FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

-- Publica o chat no Realtime (entrega instantânea, respeitando o RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comunidade_chat'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comunidade_chat;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 15. FERRAMENTAS ABA (persistência)
-- ══════════════════════════════════════════════════════════════

-- ── 15a. Quadro de fichas (token economy) do adolescente ─────
CREATE TABLE IF NOT EXISTS aba_fichas (
  id_neurodivergente UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  meta       TEXT DEFAULT '',
  total      INTEGER NOT NULL DEFAULT 5  CHECK (total BETWEEN 1 AND 12),
  ganhas     INTEGER NOT NULL DEFAULT 0  CHECK (ganhas >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE aba_fichas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aba_fichas_self ON aba_fichas;
CREATE POLICY aba_fichas_self ON aba_fichas
  FOR ALL USING (id_neurodivergente = auth.uid())
  WITH CHECK (id_neurodivergente = auth.uid());
DROP POLICY IF EXISTS aba_fichas_resp_read ON aba_fichas;
CREATE POLICY aba_fichas_resp_read ON aba_fichas
  FOR SELECT USING (
    id_neurodivergente IN (SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid())
  );

DROP TRIGGER IF EXISTS aba_fichas_updated_at ON aba_fichas;
CREATE TRIGGER aba_fichas_updated_at
  BEFORE UPDATE ON aba_fichas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 15b. Registros de Análise ABC do cuidador ────────────────
CREATE TABLE IF NOT EXISTS aba_abc (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cuidador   UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  antecedente   TEXT,
  comportamento TEXT NOT NULL,
  consequencia  TEXT,
  analise       TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aba_abc_cuid ON aba_abc (id_cuidador, criado_em DESC);
ALTER TABLE aba_abc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aba_abc_self ON aba_abc;
CREATE POLICY aba_abc_self ON aba_abc
  FOR ALL USING (id_cuidador = auth.uid())
  WITH CHECK (id_cuidador = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- RPCs (FUNÇÕES REMOTAS)
-- ══════════════════════════════════════════════════════════════

-- ── Login por celular: telefone -> e-mail ───────────────────
CREATE OR REPLACE FUNCTION public.email_por_telefone(tel TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE p.telefone = regexp_replace(COALESCE(tel,''), '\D', '', 'g')
    AND p.telefone IS NOT NULL
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.email_por_telefone(TEXT) TO anon, authenticated;

-- ── Cadastro: o telefone já está em uso? ────────────────────
CREATE OR REPLACE FUNCTION public.telefone_existe(tel TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE telefone = regexp_replace(COALESCE(tel,''), '\D', '', 'g')
      AND telefone IS NOT NULL
  );
$$;
GRANT EXECUTE ON FUNCTION public.telefone_existe(TEXT) TO anon, authenticated;

-- ── Aceitar vínculo via código ──────────────────────────────
CREATE OR REPLACE FUNCTION aceitar_vinculo(p_codigo TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teen_id  UUID;
  v_resp_tipo TEXT;
BEGIN
  SELECT tipo INTO v_resp_tipo FROM profiles WHERE id = auth.uid();
  IF v_resp_tipo NOT IN ('responsavel','terapeuta') THEN
    RETURN 'tipo_invalido';
  END IF;

  SELECT id INTO v_teen_id FROM neurodivergente
    WHERE codigo_vinculo = upper(p_codigo) AND id_responsavel IS NULL;

  IF v_teen_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM neurodivergente WHERE codigo_vinculo = upper(p_codigo)) THEN
      RETURN 'ja_vinculado';
    END IF;
    RETURN 'codigo_invalido';
  END IF;

  UPDATE neurodivergente SET id_responsavel = auth.uid() WHERE id = v_teen_id;
  RETURN 'ok';
END;
$$;

-- ── Adicionar XP com auto level-up ──────────────────────────
CREATE OR REPLACE FUNCTION adicionar_xp(p_quantidade INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_xp_atual   INTEGER;
  v_nivel_atual INTEGER;
  v_novo_xp    INTEGER;
  v_novo_nivel INTEGER;
  v_xp_proximo INTEGER;
BEGIN
  SELECT xp, nivel INTO v_xp_atual, v_nivel_atual FROM neurodivergente WHERE id = auth.uid();
  IF v_xp_atual IS NULL THEN
    RETURN jsonb_build_object('erro', 'usuario_nao_encontrado');
  END IF;

  v_novo_xp    := v_xp_atual + p_quantidade;
  v_novo_nivel := v_nivel_atual;

  LOOP
    v_xp_proximo := v_novo_nivel * 100;
    EXIT WHEN v_novo_xp < v_xp_proximo;
    v_novo_xp    := v_novo_xp - v_xp_proximo;
    v_novo_nivel := v_novo_nivel + 1;
  END LOOP;

  UPDATE neurodivergente SET xp = v_novo_xp, nivel = v_novo_nivel WHERE id = auth.uid();

  RETURN jsonb_build_object('xp', v_novo_xp, 'nivel', v_novo_nivel, 'level_up', v_novo_nivel > v_nivel_atual);
END;
$$;

-- ── Resumo rápido do adolescente (dashboard) ────────────────
CREATE OR REPLACE FUNCTION resumo_adolescente(p_teen_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_teen_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM neurodivergente WHERE id = p_teen_id AND id_responsavel = auth.uid()
  ) THEN
    RETURN jsonb_build_object('erro', 'sem_permissao');
  END IF;

  SELECT jsonb_build_object(
    'humor_hoje', (SELECT nivel FROM humores WHERE id_neurodivergente = p_teen_id AND timestamp >= CURRENT_DATE ORDER BY timestamp DESC LIMIT 1),
    'alertas_nao_lidos', (SELECT COUNT(*) FROM alertas WHERE id_neurodivergente = p_teen_id AND lido = false),
    'total_diario', (SELECT COUNT(*) FROM diario_entradas WHERE id_neurodivergente = p_teen_id),
    'conquistas', (SELECT COUNT(*) FROM conquistas_usuario WHERE id_neurodivergente = p_teen_id),
    'xp', (SELECT xp FROM neurodivergente WHERE id = p_teen_id),
    'nivel', (SELECT nivel FROM neurodivergente WHERE id = p_teen_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public' ORDER BY table_name;
--
-- Tabelas esperadas (19):
--   aba_abc, aba_fichas, alertas, comunidade_apoios, comunidade_chat,
--   comunidade_comentarios, comunidade_posts, conquistas_usuario, conversas,
--   diario_entradas, eventos_calendario, humores, memoria_lumi,
--   neurodivergente, observacoes_cuidador, preferencias_usuario, profiles,
--   relatorios, sessoes_roleplay
-- ══════════════════════════════════════════════════════════════
