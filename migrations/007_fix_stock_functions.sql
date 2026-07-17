-- Fix reserve_inventory_for_order - use quantidade_disponivel + inventory_lot_id
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(
  p_order_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_clinic_id UUID;
  v_order_status compounding_order_status;
  v_item RECORD;
  v_lote RECORD;
  v_total_reserved NUMERIC;
  v_required_qty NUMERIC;
  v_remaining_qty NUMERIC;
  v_all_available BOOLEAN := TRUE;
  v_any_missing BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: usuario nao autenticado';
  END IF;

  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'estoquista') THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: permissao negada';
  END IF;

  SELECT clinic_id, status INTO v_clinic_id, v_order_status
  FROM compounding_orders WHERE id = p_order_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: ordem nao encontrada';
  END IF;

  IF v_order_status NOT IN ('APPROVED_FOR_PRODUCTION', 'CHECKING_STOCK', 'MISSING_STOCK') THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: status invalido (%)', v_order_status;
  END IF;

  FOR v_item IN
    SELECT coi.id, coi.inventory_item_id, coi.total_required_quantity, coi.unit, coi.technical_margin_quantity
    FROM compounding_order_items coi
    WHERE coi.order_id = p_order_id
    ORDER BY coi.sequence
  LOOP
    v_required_qty := v_item.total_required_quantity + COALESCE(v_item.technical_margin_quantity, 0);
    v_remaining_qty := v_required_qty;
    v_total_reserved := 0;

    FOR v_lote IN
      SELECT id, quantidade_disponivel, quantidade_reservada, numero_lote
      FROM lotes
      WHERE produto_id = v_item.inventory_item_id
        AND status = 'APPROVED'
        AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
        AND (CAST(quantidade_disponivel AS NUMERIC) - COALESCE(quantidade_reservada, 0)) > 0
      ORDER BY data_validade ASC NULLS LAST, data_recebimento ASC
      FOR UPDATE
    LOOP
      IF v_remaining_qty <= 0 THEN EXIT; END IF;

      INSERT INTO inventory_lot_reservations (
        clinic_id, order_id, order_item_id, inventory_item_id, inventory_lot_id, reserved_quantity, unit, status, reserved_by
      ) VALUES (
        v_clinic_id, p_order_id, v_item.id, v_item.inventory_item_id, v_lote.id,
        LEAST(v_remaining_qty, CAST(v_lote.quantidade_disponivel AS NUMERIC) - COALESCE(v_lote.quantidade_reservada, 0)),
        v_item.unit,
        'ACTIVE', v_user_id
      );

      v_total_reserved := v_total_reserved + LEAST(v_remaining_qty, CAST(v_lote.quantidade_disponivel AS NUMERIC) - COALESCE(v_lote.quantidade_reservada, 0));
      v_remaining_qty := v_required_qty - v_total_reserved;
    END LOOP;

    IF v_total_reserved < v_required_qty THEN
      v_all_available := FALSE;
      v_any_missing := TRUE;
    END IF;
  END LOOP;

  UPDATE compounding_orders
  SET status = CASE WHEN v_all_available THEN 'STOCK_RESERVED'::compounding_order_status ELSE 'MISSING_STOCK'::compounding_order_status END
  WHERE id = p_order_id;

  RETURN p_order_id;
END;
$$;
