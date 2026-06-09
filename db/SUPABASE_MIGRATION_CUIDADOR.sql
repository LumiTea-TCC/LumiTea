-- ============================================================
-- LumiTEA — MIGRATION 2026-05-29 (Página do Cuidador)
-- ============================================================
-- Como aplicar:
--   1. Abra o SQL Editor do projeto Supabase
--   2. Cole TODO este arquivo
--   3. Clique em RUN
--
-- É 100% idempotente — pode rodar mais de uma vez sem quebrar.
--
-- O que adiciona:
--   • RPC stats_cuidador — retorna estatísticas agregadas para o
--     cuidador sem expor conteúdo bruto das conversas (SECURITY DEFINER)
--   • Policy eventos_insert_cuidador — permite cuidador inserir
--     eventos para o adolescente vinculado
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. RPC: stats_cuidador
--    Retorna contagens agregadas para o dashboard do cuidador.
--    SECURITY DEFINER: bypassa RLS para contar conversas/diário
--    sem expor conteúdo. O cuidador nunca vê as mensagens em si.
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
  -- Garante que o chamador é o responsável vinculado
  SELECT id_responsavel INTO v_resp_id
    FROM neurodivergente WHERE id = p_adolescente_id;

  IF v_resp_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('erro', 'nao_vinculado');
  END IF;

  -- Conta mensagens do adolescente (role = 'user')
  SELECT COUNT(*) INTO v_total_conv
    FROM conversas
   WHERE id_neurodivergente = p_adolescente_id
     AND role = 'user'
     AND timestamp BETWEEN p_inicio AND p_fim;

  -- Conta entradas do diário (privadas + públicas, apenas contagem)
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

-- Garante que a função seja acessível para usuários autenticados
GRANT EXECUTE ON FUNCTION stats_cuidador(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 2. Policy para o cuidador inserir eventos do adolescente
--    (Garante que o cuidador pode adicionar eventos via API)
-- ══════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Verifica se a policy já existe para evitar erro
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'eventos_calendario'
      AND policyname = 'eventos_cuidador_insert'
  ) THEN
    CREATE POLICY "eventos_cuidador_insert" ON eventos_calendario
      FOR INSERT WITH CHECK (
        id_neurodivergente IN (
          SELECT id FROM neurodivergente WHERE id_responsavel = auth.uid()
        )
        AND id_cuidador = auth.uid()
      );
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 3. Policy para o cuidador ler conversas do relatorio (COUNT)
--    Apenas a API de relatório usa isso via SECURITY DEFINER RPC
-- ══════════════════════════════════════════════════════════════
-- Nota: a leitura de conversas bruta permanece restrita ao adolescente.
-- O RPC stats_cuidador acima já resolve o dashboard.
-- Para o relatório: a função gerarRelatorio do backend usa o cliente
-- server-side e agora deve chamar o RPC em vez de query direta.


-- ══════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ══════════════════════════════════════════════════════════════
