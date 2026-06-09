-- ============================================================
-- LumiTEA — Schema completo para Supabase
-- Versão: 2.0
-- Última atualização: 2026-05-08
--
-- Como aplicar:
--   1. Abra o Supabase SQL Editor do projeto
--   2. Cole este arquivo inteiro
--   3. Execute (RUN)
--
-- Este arquivo é a fonte da verdade. Toda mudança de schema
-- entra aqui ANTES de ser aplicada no banco.
-- ============================================================

-- ── EXTENSÕES ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ══════════════════════════════════════════════════════════════
-- 1. PROFILES
--    Tabela central de usuários (todos os tipos)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL DEFAULT '',
  sobrenome   TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL CHECK (tipo IN ('neurodivergente','responsavel','terapeuta')),
  avatar_url  TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_all" ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "profiles_resp_read" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: cria perfil automaticamente após signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, sobrenome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', ''),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'neurodivergente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- 2. NEURODIVERGENTE
--    Dados exclusivos do adolescente neurodivergente
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS neurodivergente (
  id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp              INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  nivel           INTEGER NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  codigo_vinculo  TEXT UNIQUE,
  id_responsavel  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nascimento      DATE,
  apelido         TEXT,
  nome_mascote    TEXT DEFAULT 'Theo',
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nd_responsavel ON neurodivergente(id_responsavel);
CREATE INDEX IF NOT EXISTS idx_nd_codigo      ON neurodivergente(codigo_vinculo);

ALTER TABLE neurodivergente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nd_self" ON neurodivergente
  FOR ALL USING (id = auth.uid());

CREATE POLICY "nd_responsavel" ON neurodivergente
  FOR ALL USING (id_responsavel = auth.uid());

-- Trigger: cria registro em neurodivergente ao criar perfil neurodivergente
CREATE OR REPLACE FUNCTION criar_neurodivergente()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'neurodivergente' THEN
    INSERT INTO public.neurodivergente (id, codigo_vinculo)
    VALUES (
      NEW.id,
      upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION criar_neurodivergente();


-- ══════════════════════════════════════════════════════════════
-- 3. PREFERENCIAS_USUARIO
--    Configurações de acessibilidade e UX
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
  modo_ia            TEXT DEFAULT 'acolhedor' CHECK (modo_ia IN ('acolhedor','logico','minimalista','silencioso')),
  adaptacao_ui       BOOLEAN DEFAULT true,
  gamificacao        BOOLEAN DEFAULT true,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE preferencias_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_self" ON preferencias_usuario
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE TRIGGER prefs_updated_at
  BEFORE UPDATE ON preferencias_usuario
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: cria preferências padrão ao criar perfil neurodivergente
CREATE OR REPLACE FUNCTION criar_preferencias_padrao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'neurodivergente' THEN
    INSERT INTO public.preferencias_usuario (id_neurodivergente)
    VALUES (NEW.id)
    ON CONFLICT (id_neurodivergente) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_prefs ON profiles;
CREATE TRIGGER on_profile_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION criar_preferencias_padrao();


-- ══════════════════════════════════════════════════════════════
-- 4. MEMORIA_LUMI
--    Memória personalizada da IA por usuário
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memoria_lumi (
  id_neurodivergente UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  fatos              JSONB DEFAULT '[]'::jsonb,
  resumo             TEXT DEFAULT '',
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memoria_lumi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memoria_self" ON memoria_lumi
  FOR ALL USING (id_neurodivergente = auth.uid());

-- IMPORTANTE: cuidador NÃO tem acesso à memória da Theo do adolescente.
-- Firewall total — fatos pessoais ficam apenas com o adolescente e a IA.

CREATE TRIGGER memoria_updated_at
  BEFORE UPDATE ON memoria_lumi
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 5. CONVERSAS
--    Histórico de mensagens com a Theo (IA)
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

CREATE POLICY "conv_self" ON conversas
  FOR ALL USING (id_neurodivergente = auth.uid());

-- Cuidador NÃO vê conteúdo bruto das conversas. Apenas estatísticas
-- agregadas via RPC. Tirar a policy de leitura para responsável.


-- ══════════════════════════════════════════════════════════════
-- 6. HUMORES
--    Registro diário de humor do adolescente
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

CREATE POLICY "humores_self_read"   ON humores FOR SELECT USING (id_neurodivergente = auth.uid());
CREATE POLICY "humores_self_insert" ON humores FOR INSERT WITH CHECK (id_neurodivergente = auth.uid());
CREATE POLICY "humores_self_update" ON humores FOR UPDATE USING (id_neurodivergente = auth.uid());

CREATE POLICY "humores_resp_read" ON humores
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 7. DIARIO_ENTRADAS
--    Diário pessoal com reflexão da Theo
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS diario_entradas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo             TEXT,
  texto              TEXT NOT NULL,
  humor              TEXT DEFAULT 'mais-ou-menos',
  emoji              TEXT DEFAULT '📝',
  reflexao_lumi      TEXT,
  is_privado         BOOLEAN DEFAULT true,  -- padrão privado: cuidador não vê texto
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diario_teen ON diario_entradas(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_diario_ts   ON diario_entradas(created_at DESC);

ALTER TABLE diario_entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diario_self" ON diario_entradas
  FOR ALL USING (id_neurodivergente = auth.uid());

-- Cuidador só vê entradas explicitamente compartilhadas (is_privado=false)
CREATE POLICY "diario_resp_read" ON diario_entradas
  FOR SELECT USING (
    is_privado = false AND
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

CREATE TRIGGER diario_updated_at
  BEFORE UPDATE ON diario_entradas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 8. ALERTAS
--    Notificações para o adolescente e responsável
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

CREATE POLICY "alertas_self" ON alertas
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "alertas_resp" ON alertas
  FOR ALL USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 9. RELATORIOS
--    Relatórios automáticos gerados pela IA (agregados, sem texto bruto)
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

CREATE POLICY "rel_self" ON relatorios
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "rel_resp" ON relatorios
  FOR ALL USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 10. EVENTOS_CALENDARIO
--     Eventos pessoais e de cuidadores
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

CREATE POLICY "eventos_teen" ON eventos_calendario
  FOR ALL USING (
    id_neurodivergente = auth.uid() OR id_cuidador = auth.uid()
  );

CREATE POLICY "eventos_insert" ON eventos_calendario
  FOR INSERT WITH CHECK (
    id_neurodivergente = auth.uid() OR id_cuidador = auth.uid()
  );

CREATE POLICY "eventos_resp_read" ON eventos_calendario
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 11. OBSERVACOES_CUIDADOR
--     Notas privadas do responsável/terapeuta
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

CREATE POLICY "obs_cuidador_own" ON observacoes_cuidador
  FOR ALL USING (id_cuidador = auth.uid());

CREATE POLICY "obs_terapeuta_read" ON observacoes_cuidador
  FOR SELECT USING (
    visivel_terapeuta = true AND
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 12. CONQUISTAS_USUARIO
--     Badges e conquistas desbloqueadas pelo adolescente
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

CREATE POLICY "conquistas_self" ON conquistas_usuario
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "conquistas_resp_read" ON conquistas_usuario
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 13. SESSOES_ROLEPLAY
--     Sessões de simulação social (roleplay)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessoes_roleplay (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cenario            TEXT NOT NULL,
  mensagens          JSONB DEFAULT '[]'::jsonb,
  avaliacao_lumi     TEXT,
  estrelas           INTEGER CHECK (estrelas BETWEEN 1 AND 5),
  xp_ganho           INTEGER DEFAULT 0,
  concluido          BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rp_teen ON sessoes_roleplay(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_rp_ts   ON sessoes_roleplay(created_at DESC);

ALTER TABLE sessoes_roleplay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_self" ON sessoes_roleplay
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "rp_resp_read" ON sessoes_roleplay
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

CREATE TRIGGER rp_updated_at
  BEFORE UPDATE ON sessoes_roleplay
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════
-- 14. DIAS_CUIDADO
--     Substituto saudável do streak — contador mensal cumulativo.
--     Cada dia que o adolescente abre o app conta um, sem prazo.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS dias_cuidado (
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia                DATE NOT NULL,
  PRIMARY KEY (id_neurodivergente, dia)
);

CREATE INDEX IF NOT EXISTS idx_diascuidado_teen ON dias_cuidado(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_diascuidado_dia  ON dias_cuidado(dia DESC);

ALTER TABLE dias_cuidado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diascuidado_self" ON dias_cuidado
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "diascuidado_resp_read" ON dias_cuidado
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- RPCs (FUNÇÕES REMOTAS)
-- ══════════════════════════════════════════════════════════════

-- ── RPC: Aceitar vínculo via código ─────────────────────────
CREATE OR REPLACE FUNCTION aceitar_vinculo(p_codigo TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ── RPC: Adicionar XP com auto level-up ─────────────────────
CREATE OR REPLACE FUNCTION adicionar_xp(p_quantidade INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_xp_atual   INTEGER;
  v_nivel_atual INTEGER;
  v_novo_xp    INTEGER;
  v_novo_nivel INTEGER;
  v_xp_proximo INTEGER;
BEGIN
  SELECT xp, nivel INTO v_xp_atual, v_nivel_atual
    FROM neurodivergente WHERE id = auth.uid();

  IF v_xp_atual IS NULL THEN
    RETURN jsonb_build_object('erro', 'usuario_nao_encontrado');
  END IF;

  v_novo_xp    := v_xp_atual + p_quantidade;
  v_novo_nivel := v_nivel_atual;

  -- XP necessário por nível: 100 * nivel
  LOOP
    v_xp_proximo := v_novo_nivel * 100;
    EXIT WHEN v_novo_xp < v_xp_proximo;
    v_novo_xp    := v_novo_xp - v_xp_proximo;
    v_novo_nivel := v_novo_nivel + 1;
  END LOOP;

  UPDATE neurodivergente
    SET xp = v_novo_xp, nivel = v_novo_nivel
    WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'xp',        v_novo_xp,
    'nivel',     v_novo_nivel,
    'level_up',  v_novo_nivel > v_nivel_atual
  );
END;
$$;

-- ── RPC: Marcar dia de cuidado (substitui streak) ────────────
CREATE OR REPLACE FUNCTION marcar_dia_cuidado()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_mes  INTEGER;
  v_total_geral INTEGER;
BEGIN
  INSERT INTO dias_cuidado (id_neurodivergente, dia)
  VALUES (auth.uid(), CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_total_mes FROM dias_cuidado
    WHERE id_neurodivergente = auth.uid()
      AND dia >= date_trunc('month', CURRENT_DATE);

  SELECT COUNT(*) INTO v_total_geral FROM dias_cuidado
    WHERE id_neurodivergente = auth.uid();

  RETURN jsonb_build_object(
    'dias_mes',   v_total_mes,
    'dias_total', v_total_geral
  );
END;
$$;

-- ── RPC: Resumo rápido do adolescente (para dashboard) ──────
CREATE OR REPLACE FUNCTION resumo_adolescente(p_teen_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verifica permissão
  IF p_teen_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM neurodivergente
    WHERE id = p_teen_id AND id_responsavel = auth.uid()
  ) THEN
    RETURN jsonb_build_object('erro', 'sem_permissao');
  END IF;

  SELECT jsonb_build_object(
    'humor_hoje',       (
      SELECT nivel FROM humores
      WHERE id_neurodivergente = p_teen_id
        AND timestamp >= CURRENT_DATE
      ORDER BY timestamp DESC LIMIT 1
    ),
    'alertas_nao_lidos', (
      SELECT COUNT(*) FROM alertas
      WHERE id_neurodivergente = p_teen_id AND lido = false
    ),
    'total_diario',     (
      SELECT COUNT(*) FROM diario_entradas
      WHERE id_neurodivergente = p_teen_id
    ),
    'conquistas',       (
      SELECT COUNT(*) FROM conquistas_usuario
      WHERE id_neurodivergente = p_teen_id
    ),
    'dias_cuidado_mes', (
      SELECT COUNT(*) FROM dias_cuidado
      WHERE id_neurodivergente = p_teen_id
        AND dia >= date_trunc('month', CURRENT_DATE)
    ),
    'xp',               (SELECT xp    FROM neurodivergente WHERE id = p_teen_id),
    'nivel',            (SELECT nivel FROM neurodivergente WHERE id = p_teen_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── RPC: Adicionar fato à memória da Theo ────────────────────
CREATE OR REPLACE FUNCTION adicionar_fato_memoria(p_fato TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fatos JSONB;
BEGIN
  INSERT INTO memoria_lumi (id_neurodivergente, fatos)
  VALUES (auth.uid(), jsonb_build_array(jsonb_build_object('texto', p_fato, 'em', NOW())))
  ON CONFLICT (id_neurodivergente) DO UPDATE
    SET fatos = memoria_lumi.fatos || jsonb_build_object('texto', p_fato, 'em', NOW()),
        updated_at = NOW();

  SELECT fatos INTO v_fatos FROM memoria_lumi WHERE id_neurodivergente = auth.uid();
  RETURN jsonb_build_object('ok', true, 'total', jsonb_array_length(v_fatos));
END;
$$;

-- ── RPC: Exportar todos os dados do usuário (LGPD) ───────────
CREATE OR REPLACE FUNCTION exportar_meus_dados()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  RETURN jsonb_build_object(
    'profile',     (SELECT to_jsonb(p) FROM profiles p WHERE id = v_uid),
    'neurodiv',    (SELECT to_jsonb(n) FROM neurodivergente n WHERE id = v_uid),
    'preferencias',(SELECT to_jsonb(pf) FROM preferencias_usuario pf WHERE id_neurodivergente = v_uid),
    'memoria',     (SELECT to_jsonb(m) FROM memoria_lumi m WHERE id_neurodivergente = v_uid),
    'conversas',   (SELECT jsonb_agg(to_jsonb(c)) FROM conversas c WHERE id_neurodivergente = v_uid),
    'humores',     (SELECT jsonb_agg(to_jsonb(h)) FROM humores h WHERE id_neurodivergente = v_uid),
    'diario',      (SELECT jsonb_agg(to_jsonb(d)) FROM diario_entradas d WHERE id_neurodivergente = v_uid),
    'eventos',     (SELECT jsonb_agg(to_jsonb(e)) FROM eventos_calendario e WHERE id_neurodivergente = v_uid),
    'conquistas',  (SELECT jsonb_agg(to_jsonb(cn)) FROM conquistas_usuario cn WHERE id_neurodivergente = v_uid),
    'roleplays',   (SELECT jsonb_agg(to_jsonb(s)) FROM sessoes_roleplay s WHERE id_neurodivergente = v_uid),
    'dias_cuidado',(SELECT jsonb_agg(to_jsonb(dc)) FROM dias_cuidado dc WHERE id_neurodivergente = v_uid),
    'exportado_em',NOW()
  );
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════════════
-- Execute para listar todas as tabelas criadas:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
-- Tabelas esperadas (14):
--   alertas, conquistas_usuario, conversas, diario_entradas,
--   dias_cuidado, eventos_calendario, humores, memoria_lumi,
--   neurodivergente, observacoes_cuidador, preferencias_usuario,
--   profiles, relatorios, sessoes_roleplay
--
-- RPCs esperadas (6):
--   aceitar_vinculo, adicionar_xp, marcar_dia_cuidado,
--   resumo_adolescente, adicionar_fato_memoria, exportar_meus_dados


-- ══════════════════════════════════════════════════════════════
-- MIGRATION 2026-05-20 — games + smart calendar + parent reports
-- ══════════════════════════════════════════════════════════════

-- 14. SESSOES_JOGO
--     Registro de cada partida dos jogos terapêuticos
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessoes_jogo (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jogo_id            TEXT NOT NULL,
  duracao_segundos   INT  DEFAULT 0,
  pontuacao          INT  DEFAULT 0,
  acertos            INT  DEFAULT 0,
  total              INT  DEFAULT 0,
  dificuldade        TEXT DEFAULT 'normal' CHECK (dificuldade IN ('facil','normal','dificil')),
  terminou           BOOLEAN DEFAULT false,
  dados              JSONB DEFAULT '{}'::jsonb,
  timestamp          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jogo_teen ON sessoes_jogo(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_jogo_ts   ON sessoes_jogo(timestamp DESC);

ALTER TABLE sessoes_jogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jogo_self" ON sessoes_jogo
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "jogo_resp_read" ON sessoes_jogo
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- 15. EVENTOS_CALENDARIO — colunas novas
--     contexto extra para que a IA assuma personagem em roleplay
-- ══════════════════════════════════════════════════════════════
ALTER TABLE eventos_calendario
  ADD COLUMN IF NOT EXISTS lembrete_pre_minutos INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS checkin_pre          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_pos          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS contexto_roleplay    TEXT,
  ADD COLUMN IF NOT EXISTS categoria            TEXT DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS personagens          JSONB DEFAULT '[]'::jsonb;

-- Constraint só se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eventos_categoria_chk'
  ) THEN
    ALTER TABLE eventos_calendario
      ADD CONSTRAINT eventos_categoria_chk
      CHECK (categoria IN ('escola','familia','social','saude','lazer','outro'));
  END IF;
END $$;


-- 16. LEMBRETES_EVENTO
--     Histórico de check-ins pré/pós evento e resposta do adolescente
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lembretes_evento (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento     UUID NOT NULL REFERENCES eventos_calendario(id) ON DELETE CASCADE,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('pre','pos')),
  disparado_em  TIMESTAMPTZ DEFAULT NOW(),
  resposta      TEXT,
  acao_tomada   TEXT CHECK (acao_tomada IN ('ok','conversar','praticar','dispensou'))
);

CREATE INDEX IF NOT EXISTS idx_lemb_teen ON lembretes_evento(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_lemb_ev   ON lembretes_evento(id_evento);

ALTER TABLE lembretes_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lemb_self" ON lembretes_evento
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "lemb_resp_read" ON lembretes_evento
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- 17. RELATORIOS_CUIDADOR
--     Relatórios sintéticos por período, prontos para PDF
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS relatorios_cuidador (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  id_cuidador        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  periodo_inicio     TIMESTAMPTZ NOT NULL,
  periodo_fim        TIMESTAMPTZ NOT NULL,
  dados              JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url            TEXT,
  gerado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relcu_teen ON relatorios_cuidador(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_relcu_cuid ON relatorios_cuidador(id_cuidador);
CREATE INDEX IF NOT EXISTS idx_relcu_ts   ON relatorios_cuidador(gerado_em DESC);

ALTER TABLE relatorios_cuidador ENABLE ROW LEVEL SECURITY;

-- Cuidador vinculado vê os relatórios do(s) adolescente(s) sob sua responsabilidade
CREATE POLICY "relcu_cuidador" ON relatorios_cuidador
  FOR ALL USING (
    id_cuidador = auth.uid() AND
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

-- Adolescente vê os relatórios sobre si mesmo (transparência)
CREATE POLICY "relcu_teen_read" ON relatorios_cuidador
  FOR SELECT USING (id_neurodivergente = auth.uid());


-- 18. PREFERENCIAS — toggle de compartilhamento de relatórios
-- ══════════════════════════════════════════════════════════════
ALTER TABLE preferencias_usuario
  ADD COLUMN IF NOT EXISTS compartilhar_relatorio BOOLEAN DEFAULT true;
