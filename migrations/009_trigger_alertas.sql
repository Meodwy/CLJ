-- ============================================================
-- 009: Trigger automático para geração de alertas de estoque
-- ============================================================
-- IMPORTANTE: Executar no SQL Editor do Supabase Dashboard
-- Settings > Database > SQL Editor > New Query
-- ============================================================

-- 1. Função trigger que chama gerar_alertas_estoque()
CREATE OR REPLACE FUNCTION gerar_alertas_trigger()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM gerar_alertas_estoque();
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION gerar_alertas_trigger() FROM anon, public;

-- 2. Trigger em lotes (INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_alertas_lotes ON lotes;
CREATE TRIGGER trg_alertas_lotes
  AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH STATEMENT EXECUTE FUNCTION gerar_alertas_trigger();

-- 3. Trigger em produtos (UPDATE saldo_atual ou estoque_minimo)
DROP TRIGGER IF EXISTS trg_alertas_produtos ON produtos;
CREATE TRIGGER trg_alertas_produtos
  AFTER UPDATE OF saldo_atual, estoque_minimo ON produtos
  FOR EACH STATEMENT EXECUTE FUNCTION gerar_alertas_trigger();

-- 4. Trigger em movimentacoes (INSERT)
DROP TRIGGER IF EXISTS trg_alertas_movimentacoes ON movimentacoes;
CREATE TRIGGER trg_alertas_movimentacoes
  AFTER INSERT ON movimentacoes
  FOR EACH STATEMENT EXECUTE FUNCTION gerar_alertas_trigger();

-- 5. Popular alertas existentes agora
SELECT gerar_alertas_estoque();
