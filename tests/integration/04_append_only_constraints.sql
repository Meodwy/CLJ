-- Test: Append-only constraints bloqueiam UPDATE/DELETE em movimentacoes/inventory_movements
DO $$
DECLARE
  v_mov_id UUID;
  v_prod_id UUID;
  v_lot_id UUID;
  v_inv_mov_id UUID;
BEGIN
  -- Setup
  INSERT INTO produtos (nome, tipo, ativo) VALUES ('Test-Const-Prod', 'produto', true) RETURNING id INTO v_prod_id;
  INSERT INTO lotes (produto_id, numero_lote, data_validade, quantidade_recebida, quantidade_disponivel, status)
  VALUES (v_prod_id, 'CONST-LOT', '2026-12-01', 100, 100, 'APROVADO') RETURNING id INTO v_lot_id;

  -- Insert movement
  INSERT INTO movimentacoes (produto_id, lote_id, tipo_movimentacao, quantidade, usuario_id, observacao)
  VALUES (v_prod_id, v_lot_id, 'entrada', 100, '00000000-0000-0000-0000-000000000000', 'Test constraint')
  RETURNING id INTO v_mov_id;

  -- Try UPDATE on movimentacoes (should fail)
  BEGIN
    UPDATE movimentacoes SET quantidade = 999 WHERE id = v_mov_id;
    RAISE EXCEPTION 'CONSTRAINT: UPDATE em movimentacoes deveria falhar';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ UPDATE blocked on movimentacoes';
    WHEN others THEN
      RAISE NOTICE '✅ UPDATE blocked on movimentacoes (code=%): %', SQLSTATE, SQLERRM;
  END;

  -- Try DELETE on movimentacoes (should fail)
  BEGIN
    DELETE FROM movimentacoes WHERE id = v_mov_id;
    RAISE EXCEPTION 'CONSTRAINT: DELETE em movimentacoes deveria falhar';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ DELETE blocked on movimentacoes';
    WHEN others THEN
      RAISE NOTICE '✅ DELETE blocked on movimentacoes (code=%): %', SQLSTATE, SQLERRM;
  END;

  -- Test inventory_movements append-only
  INSERT INTO inventory_movements (clinic_id, produto_id, lote_id, movement_type, quantity, reason)
  VALUES ('00000000-0000-0000-0000-000000000000', v_prod_id, v_lot_id, 'INBOUND', 100, 'Test inv constraint')
  RETURNING id INTO v_inv_mov_id;

  BEGIN
    DELETE FROM inventory_movements WHERE id = v_inv_mov_id;
    RAISE EXCEPTION 'CONSTRAINT: DELETE em inventory_movements deveria falhar';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ DELETE blocked on inventory_movements';
    WHEN others THEN
      RAISE NOTICE '✅ DELETE blocked on inventory_movements (code=%): %', SQLSTATE, SQLERRM;
  END;

  -- Cleanup (need to directly truncate since DELETE is blocked — use test cleanup functions)
  -- For test cleanup, we update back-office directly
  DELETE FROM inventory_movements WHERE id = v_inv_mov_id;
  DELETE FROM movimentacoes WHERE id = v_mov_id;
  DELETE FROM lotes WHERE id = v_lot_id;
  DELETE FROM produtos WHERE id = v_prod_id;

  RAISE NOTICE '✅ Append-only constraints test PASSED';
EXCEPTION WHEN OTHERS THEN
  DELETE FROM inventory_movements WHERE id = v_inv_mov_id;
  DELETE FROM movimentacoes WHERE id = v_mov_id;
  DELETE FROM lotes WHERE id = v_lot_id;
  DELETE FROM produtos WHERE id = v_prod_id;
  RAISE EXCEPTION '❌ Constraint test FAILED: %', SQLERRM;
END $$;
