-- Test: FEFO consumption consumes oldest lot first
-- Run via Supabase SQL editor or execute_sql

DO $$
DECLARE
  v_prod_id UUID;
  v_lot1_id UUID;
  v_lot2_id UUID;
  v_lot3_id UUID;
  v_result JSONB;
BEGIN
  -- Create test product
  INSERT INTO produtos (nome, tipo, ativo, preco_venda)
  VALUES ('Teste-FEFO-Prod', 'produto', true, 10.0)
  RETURNING id INTO v_prod_id;

  -- Create 3 lots with different expiry dates
  -- Lot 1: expires 2026-08-01 (oldest)
  INSERT INTO lotes (produto_id, numero_lote, data_validade, quantidade_recebida, quantidade_disponivel, status)
  VALUES (v_prod_id, 'LOT-OLD-001', '2026-08-01', 100, 100, 'APROVADO')
  RETURNING id INTO v_lot1_id;

  -- Lot 2: expires 2026-09-01 (middle)
  INSERT INTO lotes (produto_id, numero_lote, data_validade, quantidade_recebida, quantidade_disponivel, status)
  VALUES (v_prod_id, 'LOT-MID-002', '2026-09-01', 100, 100, 'APROVADO')
  RETURNING id INTO v_lot2_id;

  -- Lot 3: expires 2026-10-01 (newest)
  INSERT INTO lotes (produto_id, numero_lote, data_validade, quantidade_recebida, quantidade_disponivel, status)
  VALUES (v_prod_id, 'LOT-NEW-003', '2026-10-01', 100, 100, 'APROVADO')
  RETURNING id INTO v_lot3_id;

  -- Consume 150 units via FEFO (should take 100 from LOT-OLD + 50 from LOT-MID)
  SELECT public.consumir_fefo(v_prod_id, 150, 'TEST_USER', 'saida') INTO v_result;

  -- Verify result
  ASSERT v_result->>'total_atendido' = 'true', 'FEFO: total_atendido deve ser true';

  -- Verify old lot depleted
  ASSERT (SELECT quantidade_disponivel FROM lotes WHERE id = v_lot1_id) = 0, 'FEFO: lote antigo deve zerar';

  -- Verify middle lot partially consumed (100 - 50 = 50)
  ASSERT (SELECT quantidade_disponivel FROM lotes WHERE id = v_lot2_id) = 50, 'FEFO: lote medio deve ter 50 restantes';

  -- Verify newest lot untouched
  ASSERT (SELECT quantidade_disponivel FROM lotes WHERE id = v_lot3_id) = 100, 'FEFO: lote novo deve permanecer 100';

  -- Verify movement record created
  ASSERT (SELECT COUNT(*) FROM movimentacoes WHERE produto_id = v_prod_id AND tipo_movimentacao = 'saida') >= 2, 'FEFO: deve ter movimentacoes registradas';

  -- Cleanup
  DELETE FROM movimentacoes WHERE produto_id = v_prod_id;
  DELETE FROM lotes WHERE id IN (v_lot1_id, v_lot2_id, v_lot3_id);
  DELETE FROM produtos WHERE id = v_prod_id;

  RAISE NOTICE '✅ FEFO consumption test PASSED';
EXCEPTION WHEN OTHERS THEN
  -- Cleanup on failure
  DELETE FROM movimentacoes WHERE produto_id = v_prod_id;
  DELETE FROM lotes WHERE id IN (v_lot1_id, v_lot2_id, v_lot3_id);
  DELETE FROM produtos WHERE id = v_prod_id;
  RAISE EXCEPTION '❌ FEFO test FAILED: %', SQLERRM;
END $$;
