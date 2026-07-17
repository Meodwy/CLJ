-- ============================================================
-- CLJ Clinica — Fase 3: Custos de Manipulacao
-- compounding_order_costs, custo por lote consumido
-- ============================================================

-- ============================================
-- 3.1 compounding_order_costs
-- ============================================
CREATE TABLE IF NOT EXISTS compounding_order_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  compounding_order_id UUID NOT NULL REFERENCES compounding_orders(id),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('RAW_MATERIAL','ACTIVE_INGREDIENT','EXCIPIENT','PACKAGING','PROCESS_LOSS','DIRECT_LABOR','SERVICE','OVERHEAD','QUALITY_CONTROL','ADJUSTMENT')),
  product_id UUID REFERENCES produtos(id),
  inventory_lot_id UUID REFERENCES lotes(id),
  quantity NUMERIC NOT NULL,
  unit TEXT,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE compounding_order_costs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compounding_order_costs_order ON compounding_order_costs(compounding_order_id);
CREATE INDEX IF NOT EXISTS idx_compounding_order_costs_lot ON compounding_order_costs(inventory_lot_id);

-- RLS
DROP POLICY IF EXISTS coc_select ON compounding_order_costs; DROP POLICY IF EXISTS coc_insert ON compounding_order_costs;
CREATE POLICY coc_select ON compounding_order_costs FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico'));
CREATE POLICY coc_insert ON compounding_order_costs FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

-- ============================================
-- 3.2 Atualizar complete_production p/ registrar custos
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_production_v2(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_clinic_id UUID;
  v_current_status compounding_order_status;
  v_total_steps INTEGER; v_completed_steps INTEGER; v_pending_steps INTEGER;
  v_open_critical INTEGER; v_lot_reservation RECORD; v_total_consumed NUMERIC;
  v_lot_cost NUMERIC; v_batch_number TEXT;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'complete_production_v2: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'complete_production_v2: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'complete_production_v2: ordem nao encontrada'; END IF;
  IF v_current_status IN ('PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL') THEN RETURN p_order_id; END IF;

  -- Validate steps
  SELECT COUNT(*) INTO v_total_steps FROM compounding_steps WHERE order_id=p_order_id;
  SELECT COUNT(*) INTO v_completed_steps FROM compounding_steps WHERE order_id=p_order_id AND status='COMPLETED';
  SELECT COUNT(*) INTO v_pending_steps FROM compounding_steps WHERE order_id=p_order_id AND status IN('PENDING','IN_PROGRESS');
  IF v_completed_steps=0 THEN RAISE EXCEPTION 'complete_production_v2: nenhuma etapa concluida'; END IF;
  IF v_pending_steps>0 THEN RAISE EXCEPTION 'complete_production_v2: % etapas pendentes',v_pending_steps; END IF;

  -- Validate deviations
  SELECT COUNT(*) INTO v_open_critical FROM compounding_deviations WHERE order_id=p_order_id AND status IN('OPEN','INVESTIGATION')AND severity='CRITICAL';
  IF v_open_critical>0 THEN RAISE EXCEPTION 'complete_production_v2: % deviacoes criticas',v_open_critical; END IF;

  -- Consume reservations + record costs
  FOR v_lot_reservation IN SELECT * FROM inventory_lot_reservations WHERE order_id=p_order_id AND status IN('ACTIVE','PARTIALLY_CONSUMED') FOR UPDATE LOOP
    SELECT COALESCE(SUM(cw.actual_quantity),0) INTO v_total_consumed FROM compounding_weighings cw WHERE cw.reservation_id=v_lot_reservation.id AND cw.status IN('RECORDED','VERIFIED');
    IF v_total_consumed=0 THEN v_total_consumed:=v_lot_reservation.reserved_quantity; END IF;

    -- Get unit cost from lot
    SELECT COALESCE(custo_unitario,0) INTO v_lot_cost FROM lotes WHERE id=v_lot_reservation.inventory_lot_id;

    -- Update reservation status
    UPDATE inventory_lot_reservations SET consumed_quantity=v_total_consumed,
      status=CASE WHEN v_total_consumed>=v_lot_reservation.reserved_quantity THEN 'CONSUMED' WHEN v_total_consumed>0 THEN 'PARTIALLY_CONSUMED' ELSE 'RELEASED' END
      WHERE id=v_lot_reservation.id;

    -- Update order items
    UPDATE compounding_order_items SET actual_consumed_quantity=actual_consumed_quantity+v_total_consumed WHERE id=v_lot_reservation.order_item_id;

    -- Record cost per lote consumido
    INSERT INTO compounding_order_costs(clinic_id,compounding_order_id,cost_type,product_id,inventory_lot_id,quantity,unit,unit_cost,source_type,source_id,created_by)
    VALUES(v_clinic_id,p_order_id,'RAW_MATERIAL',v_lot_reservation.inventory_item_id,v_lot_reservation.inventory_lot_id,v_total_consumed,v_lot_reservation.unit,v_lot_cost,'inventory_lot_reservations',v_lot_reservation.id::text,v_user_id);

    -- Movement
    INSERT INTO inventory_movements(clinic_id,produto_id,lote_id,movement_type,quantity,unit,reference_type,reference_id,reason,created_by)
    VALUES(v_clinic_id,v_lot_reservation.inventory_item_id,v_lot_reservation.inventory_lot_id,'PRODUCTION_CONSUMPTION',v_total_consumed,v_lot_reservation.unit,'compounding_orders',p_order_id,'Consumo producao (v2)',v_user_id);

    -- Update lot quantities
    UPDATE lotes SET quantidade=GREATEST(quantidade-v_total_consumed,0),quantidade_reservada=GREATEST(quantidade_reservada-v_total_consumed,0),quantidade_disponivel=GREATEST(quantidade_disponivel-v_total_consumed,0)
    WHERE id=v_lot_reservation.inventory_lot_id;
  END LOOP;

  -- Generate batch number
  v_batch_number:='BAT-'||TO_CHAR(NOW(),'YYYYMMDD')||'-'||LPAD((SELECT COALESCE(MAX(SPLIT_PART(COALESCE(final_batch_number,'BAT-00000000-0000'),'-',3)::INTEGER),0)+1
    FROM compounding_orders WHERE final_batch_number LIKE 'BAT-'||TO_CHAR(NOW(),'YYYYMMDD')||'-%')::TEXT,4,'0');

  UPDATE compounding_orders SET status='PRODUCTION_COMPLETED',final_batch_number=v_batch_number,production_completed_at=NOW() WHERE id=p_order_id;

  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason)
    VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'PRODUCTION_COMPLETED',v_user_id,'Producao concluida v2 lote '||v_batch_number);

  INSERT INTO business_events(event_type,source_type,source_id,created_by)
    VALUES('PRODUCTION_COMPLETED','compounding_orders',p_order_id::text,v_user_id);
  RETURN p_order_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.complete_production_v2 TO authenticated;

-- ============================================================
-- 3.3 RPC: get_order_cost (consulta custo total da ordem)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_compounding_order_cost(p_order_id UUID)
RETURNS JSONB SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_cost JSONB;
BEGIN
  SELECT jsonb_build_object(
    'order_id', p_order_id,
    'total_material_cost', COALESCE(SUM(total_cost) FILTER (WHERE cost_type IN ('RAW_MATERIAL','ACTIVE_INGREDIENT','EXCIPIENT','PACKAGING')), 0),
    'total_loss_cost', COALESCE(SUM(total_cost) FILTER (WHERE cost_type = 'PROCESS_LOSS'), 0),
    'total_labor_cost', COALESCE(SUM(total_cost) FILTER (WHERE cost_type = 'DIRECT_LABOR'), 0),
    'total_overhead', COALESCE(SUM(total_cost) FILTER (WHERE cost_type IN ('SERVICE','OVERHEAD','QUALITY_CONTROL')), 0),
    'grand_total', COALESCE(SUM(total_cost), 0),
    'lots_used', jsonb_agg(jsonb_build_object('lot_id', inventory_lot_id, 'cost', total_cost)) FILTER (WHERE inventory_lot_id IS NOT NULL)
  ) INTO v_cost
  FROM compounding_order_costs WHERE compounding_order_id = p_order_id;
  RETURN COALESCE(v_cost, '{}'::jsonb);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_compounding_order_cost TO authenticated;

-- ============================================================
-- FIM FASE 3
-- ============================================================
