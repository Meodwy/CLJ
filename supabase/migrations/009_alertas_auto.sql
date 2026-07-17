-- ============================================================
-- MIGRATION 009: Alertas automaticos + triggers
-- ============================================================
-- Cria a funcao gerar_alertas_estoque(), triggers que a
-- chamam automaticamente, e funcao wrapper com retorno.
-- ============================================================

-- 1. Funcao principal de geracao de alertas
CREATE OR REPLACE FUNCTION public.gerar_alertas_estoque()
RETURNS void
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  -- Estoque abaixo do minimo
  INSERT INTO alertas (tipo, produto_id, mensagem)
  SELECT 'estoque_minimo', p.id,
    'Estoque abaixo do minimo: ' || p.nome || ' (saldo: ' || p.saldo_atual || ', minimo: ' || p.estoque_minimo || ')'
  FROM produtos p
  WHERE p.ativo AND p.estoque_minimo > 0 AND p.saldo_atual <= p.estoque_minimo
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.produto_id = p.id AND a.tipo = 'estoque_minimo' AND a.lido = false);

  -- Produtos vencidos
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencido', l.produto_id, l.id,
    'Lote vencido: ' || p.nome || ' - Lote ' || l.numero_lote || ' (vencido em ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0 AND l.data_validade < CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencido' AND a.lido = false);

  -- Vencendo em 30 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_30', l.produto_id, l.id,
    'Vence em 30 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_30' AND a.lido = false);

  -- Vencendo em 60 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_60', l.produto_id, l.id,
    'Vence em 60 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_60' AND a.lido = false);

  -- Vencendo em 90 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_90', l.produto_id, l.id,
    'Vence em 90 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_90' AND a.lido = false);

  -- Lotes sem quantidade
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'lote_zerado', l.produto_id, l.id,
    'Lote sem quantidade: ' || p.nome || ' - Lote ' || l.numero_lote
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel = 0 AND l.quantidade_recebida > 0
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'lote_zerado' AND a.lido = false);
END;
$$ LANGUAGE plpgsql;

-- 2. Funcao wrapper que gera alertas e retorna contagens por tipo
CREATE OR REPLACE FUNCTION public.gerar_alertas_estoque_e_notificar()
RETURNS TABLE(tipo TEXT, quantidade BIGINT)
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.gerar_alertas_estoque();

  RETURN QUERY
  SELECT a.tipo, COUNT(*)::BIGINT
  FROM alertas a
  WHERE a.lido = false
  GROUP BY a.tipo;
END;
$$ LANGUAGE plpgsql;

-- 3. Funcao trigger: chamar apos alteracao em lotes
CREATE OR REPLACE FUNCTION public.trig_gerar_alertas_lotes()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.gerar_alertas_estoque();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Funcao trigger: chamar apos atualizacao de saldo/estoque_minimo em produtos
CREATE OR REPLACE FUNCTION public.trig_gerar_alertas_produtos()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.saldo_atual IS DISTINCT FROM NEW.saldo_atual
     OR OLD.estoque_minimo IS DISTINCT FROM NEW.estoque_minimo THEN
    PERFORM public.gerar_alertas_estoque();
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Remover triggers antigos (se existirem)
DROP TRIGGER IF EXISTS trg_gerar_alertas_lotes ON lotes;
DROP TRIGGER IF EXISTS trg_gerar_alertas_produtos ON produtos;

-- 6. Criar triggers (FOR EACH STATEMENT = uma execucao por statement, nao por linha)
CREATE TRIGGER trg_gerar_alertas_lotes
  AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH STATEMENT EXECUTE FUNCTION public.trig_gerar_alertas_lotes();

CREATE TRIGGER trg_gerar_alertas_produtos
  AFTER UPDATE ON produtos
  FOR EACH STATEMENT EXECUTE FUNCTION public.trig_gerar_alertas_produtos();

-- 7. Revogar acesso de anon/public
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_estoque() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_estoque_e_notificar() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trig_gerar_alertas_lotes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trig_gerar_alertas_produtos() FROM anon, public;

-- 8. Gerar alertas iniciais (executar uma vez)
SELECT public.gerar_alertas_estoque();
