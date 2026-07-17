-- Test: Venda cria AR automaticamente + outstanding_amount correto
DO $$
DECLARE
  v_paciente_id UUID;
  v_prod_id UUID;
  v_venda_id UUID;
  v_ar_id UUID;
BEGIN
  -- Create test patient
  INSERT INTO pacientes (nome, documento, telefone)
  VALUES ('Test AR Patient', '000.000.000-00', '(11) 99999-9999')
  RETURNING id INTO v_paciente_id;

  -- Create test product
  INSERT INTO produtos (nome, tipo, ativo, preco_venda)
  VALUES ('Test-AR-Prod', 'produto', true, 50.0)
  RETURNING id INTO v_prod_id;

  -- Create a sale (should auto-create AR via trigger)
  INSERT INTO vendas (paciente_id, valor_total, forma_pagamento, data_venda, usuario_id)
  VALUES (v_paciente_id, 150.0, 'dinheiro', NOW(), '00000000-0000-0000-0000-000000000000')
  RETURNING id INTO v_venda_id;

  -- Verify AR was auto-created
  SELECT id INTO v_ar_id FROM accounts_receivable WHERE sale_id = v_venda_id;
  ASSERT v_ar_id IS NOT NULL, 'AR: deve criar conta a receber automaticamente';

  -- Verify original_amount matches sale total
  ASSERT (SELECT original_amount FROM accounts_receivable WHERE id = v_ar_id) = 150.0, 'AR: valor original deve ser 150';

  -- Verify outstanding_amount = original_amount (no payments yet)
  ASSERT (SELECT outstanding_amount FROM accounts_receivable WHERE id = v_ar_id) = 150.0, 'AR: outstanding deve ser 150';

  -- Verify status is PENDING
  ASSERT (SELECT status FROM accounts_receivable WHERE id = v_ar_id) = 'PENDING', 'AR: status deve ser PENDING';

  -- Verify business event created
  ASSERT (SELECT COUNT(*) FROM business_events WHERE source_type = 'vendas' AND source_id = v_venda_id::text AND event_type = 'SALE_CREATED') = 1, 'AR: deve ter business_event SALE_CREATED';

  -- Cleanup
  DELETE FROM accounts_receivable WHERE id = v_ar_id;
  DELETE FROM business_events WHERE source_type = 'vendas' AND source_id = v_venda_id::text;
  DELETE FROM vendas WHERE id = v_venda_id;
  DELETE FROM produtos WHERE id = v_prod_id;
  DELETE FROM pacientes WHERE id = v_paciente_id;

  RAISE NOTICE '✅ Sale → AR test PASSED';
EXCEPTION WHEN OTHERS THEN
  DELETE FROM accounts_receivable WHERE sale_id = v_venda_id;
  DELETE FROM business_events WHERE source_type = 'vendas' AND source_id = v_venda_id::text;
  DELETE FROM vendas WHERE id = v_venda_id;
  DELETE FROM produtos WHERE id = v_prod_id;
  DELETE FROM pacientes WHERE id = v_paciente_id;
  RAISE EXCEPTION '❌ AR test FAILED: %', SQLERRM;
END $$;
