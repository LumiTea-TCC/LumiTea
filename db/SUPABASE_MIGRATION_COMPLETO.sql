-- ============================================================
-- LumiTEA — MIGRATION COMPLETO (2026-05-29)
-- ============================================================
-- Como aplicar:
--   1. Abra o SQL Editor do projeto Supabase
--   2. Cole TODO este arquivo
--   3. Clique em RUN
--
-- É 100% idempotente — pode rodar mais de uma vez sem quebrar.
--
-- O que este arquivo cobre:
--   • sessoes_jogo          — registro dos jogos terapêuticos
--   • lembretes_evento      — check-ins pré/pós evento do calendário
--   • relatorios_cuidador   — relatórios sintéticos da IA + PDF
--   • perfil_sensorial      — perfil sensorial do adolescente
--   • eventos_calendario    — colunas de categoria, lembrete, contexto, personagens
--   • preferencias_usuario  — coluna compartilhar_relatorio
--   • RPC stats_cuidador    — contagem segura de conversas/diário/jogos para o cuidador
--   • Policy eventos_cuidador_insert — cuidador pode adicionar eventos ao calendário
--   • Policy eventos_cuidador_delete — cuidador pode remover eventos que criou
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. SESSOES_JOGO — registro dos jogos terapêuticos
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

DROP POLICY IF EXISTS "jogo_self"      ON sessoes_jogo;
DROP POLICY IF EXISTS "jogo_resp_read" ON sessoes_jogo;

CREATE POLICY "jogo_self" ON sessoes_jogo
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "jogo_resp_read" ON sessoes_jogo
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 2. EVENTOS_CALENDARIO — colunas adicionais
-- ══════════════════════════════════════════════════════════════
ALTER TABLE eventos_calendario
  ADD COLUMN IF NOT EXISTS lembrete_pre_minutos INT     DEFAULT 60,
  ADD COLUMN IF NOT EXISTS checkin_pre          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_pos          BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS contexto_roleplay    TEXT,
  ADD COLUMN IF NOT EXISTS categoria            TEXT    DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS personagens          JSONB   DEFAULT '[]'::jsonb;

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

-- Policies para cuidador gerenciar eventos do adolescente vinculado
DROP POLICY IF EXISTS "eventos_cuidador_insert" ON eventos_calendario;
CREATE POLICY "eventos_cuidador_insert" ON eventos_calendario
  FOR INSERT WITH CHECK (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
    AND id_cuidador = auth.uid()
  );

DROP POLICY IF EXISTS "eventos_cuidador_delete" ON eventos_calendario;
CREATE POLICY "eventos_cuidador_delete" ON eventos_calendario
  FOR DELETE USING (
    id_cuidador = auth.uid() AND
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 3. LEMBRETES_EVENTO — check-ins pré e pós evento
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lembretes_evento (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento          UUID NOT NULL REFERENCES eventos_calendario(id) ON DELETE CASCADE,
  id_neurodivergente UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo               TEXT NOT NULL CHECK (tipo IN ('pre','pos')),
  disparado_em       TIMESTAMPTZ DEFAULT NOW(),
  resposta           TEXT,
  acao_tomada        TEXT CHECK (acao_tomada IN ('ok','conversar','praticar','dispensou'))
);

CREATE INDEX IF NOT EXISTS idx_lemb_teen ON lembretes_evento(id_neurodivergente);
CREATE INDEX IF NOT EXISTS idx_lemb_ev   ON lembretes_evento(id_evento);

ALTER TABLE lembretes_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lemb_self"      ON lembretes_evento;
DROP POLICY IF EXISTS "lemb_resp_read" ON lembretes_evento;

CREATE POLICY "lemb_self" ON lembretes_evento
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "lemb_resp_read" ON lembretes_evento
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 4. RELATORIOS_CUIDADOR — relatórios sintéticos prontos para PDF
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

DROP POLICY IF EXISTS "relcu_cuidador"  ON relatorios_cuidador;
DROP POLICY IF EXISTS "relcu_teen_read" ON relatorios_cuidador;

CREATE POLICY "relcu_cuidador" ON relatorios_cuidador
  FOR ALL USING (
    id_cuidador = auth.uid() AND
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

-- Adolescente pode ver os relatórios gerados sobre si (transparência)
CREATE POLICY "relcu_teen_read" ON relatorios_cuidador
  FOR SELECT USING (id_neurodivergente = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- 5. PREFERENCIAS_USUARIO — toggle de compartilhamento de relatório
-- ══════════════════════════════════════════════════════════════
ALTER TABLE preferencias_usuario
  ADD COLUMN IF NOT EXISTS compartilhar_relatorio BOOLEAN DEFAULT true;


-- ══════════════════════════════════════════════════════════════
-- 6. PERFIL_SENSORIAL — questionário sensorial do adolescente
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS perfil_sensorial (
  id_neurodivergente       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  sens_visual              INT  CHECK (sens_visual BETWEEN 1 AND 5)          DEFAULT 3,
  sens_sonora              INT  CHECK (sens_sonora BETWEEN 1 AND 5)          DEFAULT 3,
  velocidade_cognitiva     INT  CHECK (velocidade_cognitiva BETWEEN 1 AND 5) DEFAULT 3,
  nivel_estimulo_ideal     INT  CHECK (nivel_estimulo_ideal BETWEEN 1 AND 5) DEFAULT 3,
  dificuldade_social       INT  CHECK (dificuldade_social BETWEEN 1 AND 5)   DEFAULT 3,
  padrao_emocional         TEXT,
  preferencia_comunicacao  TEXT CHECK (preferencia_comunicacao IN ('texto','voz','misto')) DEFAULT 'misto',
  atualizado_em            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfs_teen ON perfil_sensorial(id_neurodivergente);

ALTER TABLE perfil_sensorial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfs_self"      ON perfil_sensorial;
DROP POLICY IF EXISTS "perfs_resp_read" ON perfil_sensorial;

CREATE POLICY "perfs_self" ON perfil_sensorial
  FOR ALL USING (id_neurodivergente = auth.uid());

CREATE POLICY "perfs_resp_read" ON perfil_sensorial
  FOR SELECT USING (
    id_neurodivergente IN (
      SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS perfs_updated_at ON perfil_sensorial;
CREATE TRIGGER perfs_updated_at
  BEFORE UPDATE ON perfil_sensorial
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();


-- ══════════════════════════════════════════════════════════════
-- 7. RPC: stats_cuidador
--    Retorna contagens agregadas para o dashboard do cuidador
--    sem expor o conteúdo bruto das conversas ou do diário.
--
--    SECURITY DEFINER: roda com permissões de superusuário,
--    mas verifica internamente que o chamador é o responsável
--    vinculado ao adolescente. Seguro e auditável.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stats_cuidador(
  p_adolescente_id UUID,
  p_inicio         TIMESTAMPTZ,
  p_fim            TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resp_id      UUID;
  v_total_conv   BIGINT;
  v_total_diario BIGINT;
  v_total_jogos  BIGINT;
BEGIN
  -- Verifica que o chamador é o responsável vinculado
  SELECT id_responsavel INTO v_resp_id
    FROM neurodivergente WHERE id = p_adolescente_id;

  IF v_resp_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('erro', 'nao_vinculado');
  END IF;

  -- Conta mensagens enviadas pelo adolescente (role = 'user')
  SELECT COUNT(*) INTO v_total_conv
    FROM conversas
   WHERE id_neurodivergente = p_adolescente_id
     AND role = 'user'
     AND timestamp BETWEEN p_inicio AND p_fim;

  -- Conta entradas do diário (privadas + públicas — apenas contagem, sem conteúdo)
  SELECT COUNT(*) INTO v_total_diario
    FROM diario_entradas
   WHERE id_neurodivergente = p_adolescente_id
     AND created_at BETWEEN p_inicio AND p_fim;

  -- Conta sessões de jogo
  SELECT COUNT(*) INTO v_total_jogos
    FROM sessoes_jogo
   WHERE id_neurodivergente = p_adolescente_id
     AND timestamp BETWEEN p_inicio AND p_fim;

  RETURN jsonb_build_object(
    'conversas', v_total_conv,
    'diario',    v_total_diario,
    'jogos',     v_total_jogos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION stats_cuidador(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════════════
-- Rode esta query para confirmar que tudo foi criado:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
-- Tabelas esperadas (17 no total):
--   alertas, conquistas_usuario, conversas, diario_entradas,
--   eventos_calendario, humores, lembretes_evento, memoria_lumi,
--   neurodivergente, observacoes_cuidador, perfil_sensorial,
--   preferencias_usuario, profiles, relatorios_cuidador,
--   sessoes_jogo, sessoes_roleplay, perfil_sensorial
--
-- Para confirmar o RPC:
--   SELECT routine_name FROM information_schema.routines
--     WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
-- ============================================================
