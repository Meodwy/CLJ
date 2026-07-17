-- ============================================================
-- Seed: Ordens de Manipulacao para todos os estagios do Kanban
-- ============================================================
-- Uso: Execute no SQL Editor do Supabase (dashboard)
-- ============================================================

-- Placeholder IDs (mesmos usados pelo app)
-- clinic_id: 00000000-0000-0000-0000-000000000001
-- patient_id: 00000000-0000-0000-0000-000000000001
-- prescription_id: 00000000-0000-0000-0000-000000000001
-- prescription_version_id: 00000000-0000-0000-0000-000000000000
-- created_by / pharmacist_id: 00000000-0000-0000-0000-000000000001

DO $$
DECLARE
  clinic_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  patient_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  rx_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  rx_ver_id CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
  user_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  order_id UUID;
  formula_id UUID;

  -- Status sequence (ordem do kanban)
  status_analise CONSTANT TEXT[] := ARRAY['DRAFT', 'AWAITING_PHARMACEUTICAL_REVIEW', 'PRESCRIPTION_PENDING', 'PRESCRIPTION_REJECTED', 'APPROVED_FOR_PRODUCTION'];
  status_estoque CONSTANT TEXT[] := ARRAY['CHECKING_STOCK', 'MISSING_STOCK', 'AWAITING_PURCHASE', 'STOCK_RESERVED'];
  status_fila CONSTANT TEXT := 'QUEUED_FOR_PRODUCTION';
  status_separacao CONSTANT TEXT := 'IN_SEPARATION';
  status_pesagem CONSTANT TEXT[] := ARRAY['AWAITING_WEIGHING', 'IN_WEIGHING'];
  status_manipulacao CONSTANT TEXT := 'IN_COMPOUNDING';
  status_controle CONSTANT TEXT[] := ARRAY['IN_PROCESS_CONTROL', 'AWAITING_PACKAGING', 'IN_PACKAGING', 'PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL', 'REWORK_REQUIRED'];
  status_liberacao CONSTANT TEXT[] := ARRAY['AWAITING_PHARMACIST_RELEASE', 'RELEASE_REJECTED', 'RELEASED_BY_PHARMACIST'];
  status_pronta CONSTANT TEXT := 'READY_FOR_PICKUP';
  status_entregue CONSTANT TEXT[] := ARRAY['OUT_FOR_DELIVERY', 'DISPENSED'];
  status_cancelado CONSTANT TEXT := 'CANCELLED';
BEGIN

  -- ============================================================
  -- Helper: criar ordem + formula + status_history
  -- ============================================================
  -- 1: ANALISE
  FOR i IN 1 .. array_length(status_analise, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((i)::text, 4, '0'),
            'Capsula', 60, 'un', status_analise[i], 'NORMAL', user_id, NOW() - ((5 - i) || ' days')::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Formula personalizada"}', '{"totalQuantity": 60, "unit": "un", "batchSize": 60, "overage": 0}', user_id, NOW() - ((5 - i) || ' days')::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 60, 3, 63, 'mg', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, NULL, status_analise[i], user_id, NOW() - ((5 - i) || ' days')::INTERVAL);
  END LOOP;

  -- 2: ESTOQUE
  FOR i IN 1 .. array_length(status_estoque, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((5 + i)::text, 4, '0'),
            'Solucao', 200, 'ml', status_estoque[i], 'HIGH', user_id, NOW() - ((4 - i) || ' days')::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Solucao oral"}', '{"totalQuantity": 200, "unit": "ml", "batchSize": 200, "overage": 5}', user_id, NOW() - ((4 - i) || ' days')::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 200, 10, 210, 'ml', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, NULL, status_estoque[i], user_id, NOW() - ((4 - i) || ' days')::INTERVAL);
  END LOOP;

  -- 3: FILA
  order_id := gen_random_uuid();
  INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, created_by, created_at)
  VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
          'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD('009', 4, '0'),
          'Pomada', 50, 'g', status_fila, 'NORMAL', user_id, NOW() - '2 days'::INTERVAL);
  formula_id := gen_random_uuid();
  INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
  VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Pomada dermatologica"}', '{"totalQuantity": 50, "unit": "g", "batchSize": 50, "overage": 2}', user_id, NOW() - '2 days'::INTERVAL);
  INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
  VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'BASE', 50, 2, 52, 'g', 1, NOW());
  INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
  VALUES (gen_random_uuid(), clinic_id, order_id, 'STOCK_RESERVED', status_fila, user_id, NOW() - '2 days'::INTERVAL);

  -- 4: SEPARACAO
  order_id := gen_random_uuid();
  INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, assigned_manipulator_id, created_by, created_at)
  VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
          'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD('010', 4, '0'),
          'Capsula', 30, 'un', status_separacao, 'URGENT', user_id, user_id, NOW() - '1 day'::INTERVAL);
  formula_id := gen_random_uuid();
  INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
  VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Formula urgente"}', '{"totalQuantity": 30, "unit": "un", "batchSize": 30, "overage": 0}', user_id, NOW() - '1 day'::INTERVAL);
  INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
  VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 30, 1, 31, 'mg', 1, NOW());
  INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
  VALUES (gen_random_uuid(), clinic_id, order_id, 'QUEUED_FOR_PRODUCTION', status_separacao, user_id, NOW() - '1 day'::INTERVAL);

  -- 5: PESAGEM (2 ordens)
  FOR i IN 1 .. array_length(status_pesagem, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, assigned_manipulator_id, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((10 + i)::text, 4, '0'),
            'Suspensao', 150, 'ml', status_pesagem[i], 'NORMAL', user_id, user_id, NOW() - '12 hours'::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Suspensao oral"}', '{"totalQuantity": 150, "unit": "ml", "batchSize": 150, "overage": 3}', user_id, NOW() - '12 hours'::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 150, 5, 155, 'ml', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, 'IN_SEPARATION', status_pesagem[i], user_id, NOW() - '12 hours'::INTERVAL);
  END LOOP;

  -- 6: MANIPULACAO
  order_id := gen_random_uuid();
  INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, assigned_manipulator_id, created_by, created_at)
  VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
          'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD('013', 4, '0'),
          'Creme', 100, 'g', status_manipulacao, 'HIGH', user_id, user_id, NOW() - '6 hours'::INTERVAL);
  formula_id := gen_random_uuid();
  INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
  VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Creme dermatologico"}', '{"totalQuantity": 100, "unit": "g", "batchSize": 100, "overage": 3}', user_id, NOW() - '6 hours'::INTERVAL);
  INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
  VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'BASE', 100, 3, 103, 'g', 1, NOW());
  INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
  VALUES (gen_random_uuid(), clinic_id, order_id, 'IN_WEIGHING', status_manipulacao, user_id, NOW() - '6 hours'::INTERVAL);

  -- 7: CONTROLE (6 ordens)
  FOR i IN 1 .. array_length(status_controle, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, assigned_manipulator_id, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((13 + i)::text, 4, '0'),
            'Capsula', 90, 'un', status_controle[i], 'NORMAL', user_id, user_id, NOW() - ((12 - i) || ' hours')::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Formula controle"}', '{"totalQuantity": 90, "unit": "un", "batchSize": 90, "overage": 0}', user_id, NOW() - ((12 - i) || ' hours')::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 90, 3, 93, 'mg', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, 'IN_COMPOUNDING', status_controle[i], user_id, NOW() - ((12 - i) || ' hours')::INTERVAL);
  END LOOP;

  -- 8: LIBERACAO (3 ordens)
  FOR i IN 1 .. array_length(status_liberacao, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, pharmacist_id, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((19 + i)::text, 4, '0'),
            'Solucao', 300, 'ml', status_liberacao[i], 'NORMAL', user_id, user_id, NOW() - ((10 - i) || ' hours')::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Solucao oral c/ controle"}', '{"totalQuantity": 300, "unit": "ml", "batchSize": 300, "overage": 10}', user_id, NOW() - ((10 - i) || ' hours')::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 3, 0, 3, 'mg', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, 'PRODUCTION_COMPLETED', status_liberacao[i], user_id, NOW() - ((10 - i) || ' hours')::INTERVAL);
  END LOOP;

  -- 9: PRONTA
  order_id := gen_random_uuid();
  INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, pharmacist_id, released_at, ready_at, created_by, created_at)
  VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
          'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD('023', 4, '0'),
          'Pomada', 30, 'g', status_pronta, 'NORMAL', user_id, NOW() - '2 hours'::INTERVAL, NOW() - '1 hour'::INTERVAL, user_id, NOW() - '3 days'::INTERVAL);
  formula_id := gen_random_uuid();
  INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
  VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Pomada dermato"}', '{"totalQuantity": 30, "unit": "g", "batchSize": 30, "overage": 0}', user_id, NOW() - '3 days'::INTERVAL);
  INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
  VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'BASE', 30, 0, 30, 'g', 1, NOW());
  INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
  VALUES (gen_random_uuid(), clinic_id, order_id, 'RELEASED_BY_PHARMACIST', status_pronta, user_id, NOW() - '1 hour'::INTERVAL);

  -- 10: ENTREGUE (2 ordens)
  FOR i IN 1 .. array_length(status_entregue, 1) LOOP
    order_id := gen_random_uuid();
    INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, pharmacist_id, released_at, ready_at, dispensed_at, created_by, created_at)
    VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
            'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD((23 + i)::text, 4, '0'),
            'Capsula', 120, 'un', status_entregue[i], 'LOW', user_id, NOW() - '2 days'::INTERVAL, NOW() - '2 days'::INTERVAL, NOW() - '1 day'::INTERVAL, user_id, NOW() - '5 days'::INTERVAL);
    formula_id := gen_random_uuid();
    INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
    VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Capsulas baixa dosagem"}', '{"totalQuantity": 120, "unit": "un", "batchSize": 120, "overage": 0}', user_id, NOW() - '5 days'::INTERVAL);
    INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
    VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'ACTIVE_INGREDIENT', 120, 5, 125, 'mg', 1, NOW());
    INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
    VALUES (gen_random_uuid(), clinic_id, order_id, 'READY_FOR_PICKUP', status_entregue[i], user_id, NOW() - '1 day'::INTERVAL);
  END LOOP;

  -- 11: CANCELADO
  order_id := gen_random_uuid();
  INSERT INTO compounding_orders (id, clinic_id, patient_id, prescription_id, prescription_version_id, internal_number, pharmaceutical_form, requested_quantity, requested_unit, status, priority, cancellation_reason, created_by, created_at)
  VALUES (order_id, clinic_id, patient_id, rx_id, rx_ver_id,
          'MC-' || to_char(NOW(), 'YYMM') || '-' || LPAD('026', 4, '0'),
          'Gel', 80, 'g', status_cancelado, 'LOW', 'Paciente desistiu do tratamento', user_id, NOW() - '4 days'::INTERVAL);
  formula_id := gen_random_uuid();
  INSERT INTO compounding_formulas (id, order_id, version_number, status, formula_data, calculation_data, created_by, created_at)
  VALUES (formula_id, order_id, 1, 'ACTIVE', '{"instructions": "Gel dermatologico"}', '{"totalQuantity": 80, "unit": "g", "batchSize": 80, "overage": 0}', user_id, NOW() - '4 days'::INTERVAL);
  INSERT INTO compounding_order_items (id, order_id, formula_id, inventory_item_id, item_type, theoretical_quantity, technical_margin_quantity, total_required_quantity, unit, sequence, created_at)
  VALUES (gen_random_uuid(), order_id, formula_id, '00000000-0000-0000-0000-000000000001', 'BASE', 80, 2, 82, 'g', 1, NOW());
  INSERT INTO compounding_status_history (id, clinic_id, order_id, previous_status, new_status, changed_by, changed_at)
  VALUES (gen_random_uuid(), clinic_id, order_id, 'AWAITING_PHARMACEUTICAL_REVIEW', status_cancelado, user_id, NOW() - '4 days'::INTERVAL);

  RAISE NOTICE 'Seed completo: 26 ordens criadas em todos os estagios do kanban!';
END $$;
