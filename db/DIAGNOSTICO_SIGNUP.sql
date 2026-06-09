-- ============================================================
-- LumiTEA — Diagnóstico do erro de cadastro
-- Rode cada bloco no Supabase → SQL Editor e me mande o resultado.
-- ============================================================

-- A) As tabelas necessárias existem?
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'neurodivergente', 'preferencias_usuario')
ORDER BY table_name;
-- Esperado: 3 linhas. Se faltar alguma, o schema não foi aplicado.

-- B) As funções estão com o search_path corrigido?
--    A coluna proconfig deve mostrar {search_path=public}.
SELECT proname, prosecdef AS security_definer, proconfig
FROM pg_proc
WHERE proname IN ('handle_new_user', 'criar_neurodivergente', 'criar_preferencias_padrao');
-- Se proconfig vier NULL, o script de correção ainda NÃO foi aplicado.

-- C) As triggers estão ativas?
SELECT tgname, tgrelid::regclass AS tabela
FROM pg_trigger
WHERE tgname IN ('on_auth_user_created', 'on_profile_created', 'on_profile_prefs');
-- Esperado: 3 linhas.

-- D) Colunas e obrigatoriedade da tabela profiles
--    (procurando alguma coluna NOT NULL sem default que estoure o INSERT)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
