-- CLJ Clínica — Migration 013_fix_production_started_at
-- Garante que complete_weighing RPC também seta production_started_at

CREATE OR REPLACE FUNCTION public.complete_weighing(
  p_order_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status TEXT;
  v_clinic_id UUID;
  v_total_items INTEGER;
  v_weighed_items INTEGER;
  v_rejected_items INTEGER;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_weighing: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'complete_weighing: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'complete_weighing: ordem não encontrada';
  END IF;

  -- 4. Idempotency — se já passou da pesagem, retorna
  IF v_current_status IN ('IN_COMPOUNDING', 'IN_PROCESS_CONTROL',
                          'AWAITING_PACKAGING', 'IN_PACKAGING',
                          'AWAITING_LABELING', 'IN_LABELING',
                          'PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL',
                          'QUARANTINED', 'AWAITING_PHARMACIST_RELEASE',
                          'RELEASED_BY_PHARMACIST', 'READY_FOR_PICKUP',
                          'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Validar status atual
  IF v_current_status NOT IN ('AWAITING_WEIGHING', 'IN_WEIGHING') THEN
    RAISE EXCEPTION 'complete_weighing: status inválido (%) para finalizar pesagem', v_current_status;
  END IF;

  -- 6. Verificar pesagens
  SELECT COUNT(*) INTO v_total_items
  FROM compounding_order_items WHERE order_id = p_order_id;

  SELECT COUNT(DISTINCT order_item_id) INTO v_weighed_items
  FROM compounding_weighings
  WHERE order_id = p_order_id AND status = 'RECORDED';

  SELECT COUNT(DISTINCT order_item_id) INTO v_rejected_items
  FROM compounding_weighings
  WHERE order_id = p_order_id AND status = 'REJECTED';

  IF v_weighed_items < v_total_items THEN
    RAISE EXCEPTION 'complete_weighing: % de % itens foram pesados dentro da tolerância', v_weighed_items, v_total_items;
  END IF;

  IF v_rejected_items > 0 THEN
    RAISE EXCEPTION 'complete_weighing: % itens possuem pesagens rejeitadas. Resolva as deviações antes de prosseguir', v_rejected_items;
  END IF;

  -- 7. Transação — seta status E production_started_at
  BEGIN
    UPDATE compounding_orders
      SET status = 'IN_COMPOUNDING',
          production_started_at = NOW()
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'IN_COMPOUNDING', v_user_id,
            'Pesagem concluída - todos os itens dentro da tolerância');

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'WEIGHING_COMPLETED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'total_items', v_total_items,
        'weighed_items', v_weighed_items
      )
    );

    RETURN p_order_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE;
  END;
END;
$$;

-- Re-grant
GRANT EXECUTE ON FUNCTION public.complete_weighing TO authenticated;
