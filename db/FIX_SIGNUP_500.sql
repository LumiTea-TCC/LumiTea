-- ============================================================
-- LumiTEA — Correção do erro "Database error saving new user"
-- (HTTP 500 em /auth/v1/signup)   —   VERSÃO ROBUSTA
--
-- CAUSA RAIZ:
--   As triggers SECURITY DEFINER que rodam no signup faziam
--   INSERT sem qualificar o schema e sem fixar o search_path.
--   A trigger roda pelo papel supabase_auth_admin, cujo
--   search_path NÃO inclui "public", então as tabelas não eram
--   encontradas e a transação inteira do cadastro era abortada.
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Recria as 3 funções com `SET search_path = public` e nomes
--      de tabela totalmente qualificados (public.*).
--   2. Envolve cada uma em tratamento de exceção: se algo
--      secundário falhar, o cadastro NÃO quebra — o erro real é
--      registrado no log do Postgres (RAISE LOG) para diagnóstico.
--   3. Recria as triggers para garantir que estão ativas.
--
-- Como aplicar:
--   Supabase → SQL Editor → cole tudo → RUN
-- ============================================================

-- 1) Cria o perfil logo após o signup ---------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
EXCEPTION WHEN OTHERS THEN
  -- Não deixa o signup falhar; registra o motivo real no log.
  RAISE LOG 'handle_new_user falhou para % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2) Cria o registro em neurodivergente -------------------------
CREATE OR REPLACE FUNCTION public.criar_neurodivergente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'criar_neurodivergente falhou para % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Cria as preferências padrão --------------------------------
CREATE OR REPLACE FUNCTION public.criar_preferencias_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 4) Garante que as triggers estão ativas -----------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.criar_neurodivergente();

DROP TRIGGER IF EXISTS on_profile_prefs ON public.profiles;
CREATE TRIGGER on_profile_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.criar_preferencias_padrao();
