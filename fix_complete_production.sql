CREATE OR REPLACE FUNCTION complete_production(p_order_id UUID, p_batch_number TEXT DEFAULT NULL)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status;
  v_clinic_id UUID; v_total_steps INTEGER; v_completed_steps INTEGER;
  v_pending_steps INTEGER; v_open_critical INTEGER;
  v_lot_reservation RECORD; v_total_consumed NUMERIC; v_batch_number TEXT;
  v_movement_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'complete_production: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN
    RAISE EXCEPTION 'complete_production: permissao negada farmaceutico';
  END IF;
  SELECT status, clinic_id INTO v_current_status, v_clinic_id FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'complete_production: ordem nao encontrada'; END IF;
  IF v_current_status IN ('PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUARANTINED','AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','DISPENSED') THEN
    RETURN p_order_id;
  END IF;
  SELECT COUNT(*) INTO v_total_steps FROM compounding_steps WHERE order_id = p_order_id;
  SELECT COUNT(*) INTO v_completed_steps FROM compounding_steps WHERE order_id = p_order_id AND status = 'COMPLETED';
  SELECT COUNT(*) INTO v_pending_steps FROM compounding_steps WHERE order_id = p_order_id AND status IN ('PENDING','IN_PROGRESS');
  IF v_completed_steps = 0 THEN RAISE EXCEPTION 'complete_production: nenhuma etapa concluida'; END IF;
  IF v_pending_steps > 0 THEN RAISE EXCEPTION 'complete_production: % etapas pendentes', v_pending_steps; END IF;
  IF EXISTS(SELECT 1 FROM compounding_order_items coi WHERE coi.order_id = p_order_id AND NOT EXISTS(SELECT 1 FROM compounding_weighings cw WHERE cw.order_item_id = coi.id AND cw.status IN ('RECORDED','VERIFIED'))) THEN
    RAISE EXCEPTION 'complete_production: itens sem pesagem';
  END IF;
  SELECT COUNT(*) INTO v_open_critical FROM compounding_deviations WHERE order_id = p_order_id AND status IN ('OPEN','INVESTIGATION') AND severity = 'CRITICAL';
  IF v_open_critical > 0 THEN RAISE EXCEPTION 'complete_production: % deviacoes criticas', v_open_critical; END IF;
  IF p_batch_number IS NOT NULL THEN v_batch_number := p_batch_number;
  ELSE v_batch_number := 'BAT-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12));
  END IF;
  UPDATE compounding_orders SET status = 'PRODUCTION_COMPLETED', production_completed_at = NOW(), final_batch_number = v_batch_number WHERE id = p_order_id;
  FOR v_lot_reservation IN
    SELECT ilr.id, ilr.inventory_lot_id, ilr.reserved_quantity, ilr.consumed_quantity,
           ilr.inventory_item_id, ilr.unit, ilr.order_item_id,
           coi.total_required_quantity, l.quantidade_disponivel, l.numero_lote
    FROM inventory_lot_reservations ilr
    JOIN lotes l ON l.id = ilr.inventory_lot_id
    JOIN compounding_order_items coi ON coi.id = ilr.order_item_id
    WHERE ilr.order_id = p_order_id AND ilr.status = 'ACTIVE'
    FOR UPDATE OF ilr
  LOOP
    v_total_consumed := COALESCE(v_lot_reservation.consumed_quantity, 0);
    UPDATE compounding_order_items SET actual_consumed_quantity = COALESCE(actual_consumed_quantity,0) + v_total_consumed WHERE id = v_lot_reservation.order_item_id;
    UPDATE inventory_lot_reservations SET
      consumed_quantity = v_total_consumed,
      status = CASE
        WHEN v_total_consumed >= v_lot_reservation.reserved_quantity THEN 'CONSUMED'::reservation_status
        WHEN v_total_consumed > 0 THEN 'PARTIALLY_CONSUMED'::reservation_status
        ELSE 'RELEASED'::reservation_status
      END
    WHERE id = v_lot_reservation.id;
    UPDATE lotes SET quantidade_disponivel = quantidade_disponivel + v_lot_reservation.reserved_quantity,
                    quantidade_reservada = quantidade_reservada - v_lot_reservation.reserved_quantity
    WHERE id = v_lot_reservation.inventory_lot_id;
  END LOOP;
  INSERT INTO compounding_status_history(clinic_id, order_id, previous_status, new_status, changed_by, reason)
  VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'PRODUCTION_COMPLETED', v_user_id, 'Producao concluida');
  PERFORM log_compounding_audit(p_clinic_id := v_clinic_id, p_order_id := p_order_id, p_event_type := 'PRODUCTION_COMPLETED', p_entity_type := 'compounding_orders', p_entity_id := p_order_id);
  RETURN p_order_id;
END;
$$;
