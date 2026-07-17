-- ============================================================
-- CLJ Clinica — Remaining Migrations (006 RPCs + 007 + 008 + 009)
-- Generado 2026-07-14
-- EJECUTAR en Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- PARTE 1: FUNCOES 006_compounding_rpc
-- ============================================================

-- 3. create_compounding_order
CREATE OR REPLACE FUNCTION public.create_compounding_order(
  p_clinic_id UUID, p_patient_id UUID,
  p_prescription_id UUID, p_prescription_version_id UUID,
  p_pharmaceutical_form TEXT, p_requested_quantity NUMERIC, p_requested_unit TEXT,
  p_priority priority_level DEFAULT 'NORMAL', p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_formula_data JSONB DEFAULT '{}', p_calculation_data JSONB DEFAULT '{}',
  p_items_json JSONB DEFAULT '[]'
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID; v_user_role TEXT; v_order_id UUID; v_formula_id UUID;
  v_internal_number TEXT; v_year TEXT; v_sequence INTEGER; v_item JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'create_compounding_order: usuario nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN
    RAISE EXCEPTION 'create_compounding_order: permissao negada'; END IF;
  v_year := TO_CHAR(NOW(),'YYYY');
  SELECT COALESCE(MAX(SPLIT_PART(internal_number,'-',3)::INTEGER),0)+1 INTO v_sequence
    FROM compounding_orders WHERE internal_number LIKE 'CLJ-'||v_year||'-%';
  v_internal_number := 'CLJ-'||v_year||'-'||LPAD(v_sequence::TEXT,4,'0');
  INSERT INTO compounding_orders(clinic_id,patient_id,prescription_id,prescription_version_id,
    internal_number,pharmaceutical_form,requested_quantity,requested_unit,status,priority,due_at,created_by)
    VALUES(p_clinic_id,p_patient_id,p_prescription_id,p_prescription_version_id,
    v_internal_number,p_pharmaceutical_form,p_requested_quantity,p_requested_unit,
    'DRAFT',p_priority,p_due_at,v_user_id) RETURNING id INTO v_order_id;
  INSERT INTO compounding_formulas(order_id,version_number,status,formula_data,calculation_data,created_by)
    VALUES(v_order_id,1,'DRAFT',p_formula_data,p_calculation_data,v_user_id) RETURNING id INTO v_formula_id;
  IF jsonb_array_length(p_items_json)=0 THEN RAISE EXCEPTION 'create_compounding_order: ao menos um item'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json) LOOP
    INSERT INTO compounding_order_items(order_id,formula_id,inventory_item_id,item_type,
      theoretical_quantity,technical_margin_quantity,total_required_quantity,unit,sequence)
      VALUES(v_order_id,v_formula_id,(v_item->>'inventory_item_id')::UUID,(v_item->>'item_type')::item_type,
      (v_item->>'theoretical_quantity')::NUMERIC,COALESCE((v_item->>'technical_margin_quantity')::NUMERIC,0),
      COALESCE((v_item->>'total_required_quantity')::NUMERIC,(v_item->>'theoretical_quantity')::NUMERIC),
      v_item->>'unit',COALESCE((v_item->>'sequence')::INTEGER,1));
  END LOOP;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason)
    VALUES(p_clinic_id,v_order_id,NULL,'DRAFT',v_user_id,'Ordem de manipulacao criada');
  PERFORM log_compounding_audit(p_clinic_id:=p_clinic_id,p_order_id:=v_order_id,
    p_event_type:='COMPOUNDING_ORDER_CREATED',p_entity_type:='compounding_orders',
    p_entity_id:=v_order_id,p_new_data:=jsonb_build_object('internal_number',v_internal_number,'formula_id',v_formula_id));
  RETURN v_order_id;
END; $$;

-- 4. submit_pharmaceutical_review
CREATE OR REPLACE FUNCTION public.submit_pharmaceutical_review(
  p_order_id UUID, p_checklist_json JSONB DEFAULT '{}',
  p_approved BOOLEAN DEFAULT TRUE, p_notes TEXT DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status;
  v_clinic_id UUID; v_new_status compounding_order_status; v_formula_id UUID;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'submit_pharmaceutical_review: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'submit_pharmaceutical_review: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'submit_pharmaceutical_review: ordem nao encontrada'; END IF;
  IF v_current_status IN ('APPROVED_FOR_PRODUCTION','PRESCRIPTION_REJECTED') THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('DRAFT','AWAITING_PHARMACEUTICAL_REVIEW') THEN RAISE EXCEPTION 'submit_pharmaceutical_review: status invalido %',v_current_status; END IF;
  v_new_status := CASE WHEN p_approved THEN 'APPROVED_FOR_PRODUCTION' ELSE 'PRESCRIPTION_REJECTED' END;
  IF v_current_status='DRAFT' THEN
    UPDATE compounding_orders SET status='AWAITING_PHARMACEUTICAL_REVIEW',pharmacist_id=v_user_id WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason)
      VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'AWAITING_PHARMACEUTICAL_REVIEW',v_user_id,'Encaminhado para revisao farmaceutica');
  END IF;
  UPDATE compounding_orders SET status=v_new_status,pharmacist_id=v_user_id WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason)
    VALUES(v_clinic_id,p_order_id,CASE WHEN v_current_status='DRAFT' THEN 'AWAITING_PHARMACEUTICAL_REVIEW' ELSE v_current_status::TEXT END,
    v_new_status::TEXT,v_user_id,CASE WHEN p_approved THEN 'Prescricao aprovada' ELSE 'Prescricao rejeitada' END);
  SELECT id INTO v_formula_id FROM compounding_formulas WHERE order_id=p_order_id ORDER BY version_number DESC LIMIT 1;
  IF v_formula_id IS NOT NULL THEN
    UPDATE compounding_formulas SET status=CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END,approved_by=v_user_id,approved_at=NOW() WHERE id=v_formula_id;
  END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='PHARMACEUTICAL_REVIEW',
    p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('approved',p_approved,'notes',p_notes));
  RETURN p_order_id;
END; $$;

-- 5. check_stock_availability
CREATE OR REPLACE FUNCTION public.check_stock_availability(p_order_id UUID)
RETURNS JSONB SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_clinic_id UUID; v_result JSONB; v_items JSONB; v_item RECORD; v_available_qty NUMERIC; v_status_text TEXT;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'check_stock_availability: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','estoquista','manipulador') THEN RAISE EXCEPTION 'check_stock_availability: permissao negada'; END IF;
  SELECT clinic_id INTO v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'check_stock_availability: ordem nao encontrada'; END IF;
  v_items := '[]'::JSONB;
  FOR v_item IN SELECT coi.id,coi.inventory_item_id,coi.total_required_quantity,coi.unit,p.nome FROM compounding_order_items coi LEFT JOIN produtos p ON p.id=coi.inventory_item_id WHERE coi.order_id=p_order_id ORDER BY coi.sequence LOOP
    SELECT COALESCE(SUM(quantidade - quantidade_reservada),0) INTO v_available_qty FROM lotes WHERE produto_id=v_item.inventory_item_id AND status='APPROVED' AND (data_validade IS NULL OR data_validade>=CURRENT_DATE);
    v_status_text := CASE WHEN v_available_qty>=v_item.total_required_quantity THEN 'AVAILABLE' WHEN v_available_qty>0 THEN 'PARTIAL' ELSE 'UNAVAILABLE' END;
    v_items := v_items || jsonb_build_object('order_item_id',v_item.id,'inventory_item_id',v_item.inventory_item_id,'product_name',v_item.nome,'required_qty',v_item.total_required_quantity,'unit',v_item.unit,'available_qty',v_available_qty,'status',v_status_text);
  END LOOP;
  v_result := jsonb_build_object('order_id',p_order_id,'items',v_items,'all_available',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) AS elem WHERE elem->>'status'!='AVAILABLE'),'checked_at',NOW());
  RETURN v_result;
END; $$;

-- 6. reserve_inventory_for_order (ORIGINAL - sera sobrescrita por 007)
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
  v_item RECORD; v_needed_qty NUMERIC; v_lot RECORD; v_reserve_qty NUMERIC;
  v_all_available BOOLEAN:=TRUE; v_missing_items TEXT[]:='{}'; v_reservation_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'reserve: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'reserve: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'reserve: ordem nao encontrada'; END IF;
  IF v_current_status IN ('STOCK_RESERVED','QUEUED_FOR_PRODUCTION','IN_SEPARATION','AWAITING_WEIGHING','IN_WEIGHING','IN_COMPOUNDING','IN_PROCESS_CONTROL','AWAITING_PACKAGING','IN_PACKAGING','AWAITING_LABELING','IN_LABELING','PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUARANTINED','AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DISPENSED') THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('APPROVED_FOR_PRODUCTION','CHECKING_STOCK','MISSING_STOCK') THEN RAISE EXCEPTION 'reserve: status invalido %',v_current_status; END IF;
  FOR v_item IN SELECT coi.id AS item_id,coi.inventory_item_id,coi.total_required_quantity,coi.unit FROM compounding_order_items coi WHERE coi.order_id=p_order_id ORDER BY coi.sequence LOOP
    v_needed_qty:=v_item.total_required_quantity;
    FOR v_lot IN SELECT id,quantidade,quantidade_reservada,(quantidade-quantidade_reservada) AS available FROM lotes WHERE produto_id=v_item.inventory_item_id AND status='APPROVED' AND (data_validade IS NULL OR data_validade>=CURRENT_DATE) AND (quantidade-quantidade_reservada)>0 ORDER BY data_validade ASC NULLS LAST,data_recebimento ASC NULLS LAST,id ASC FOR UPDATE OF lotes LOOP
      IF v_needed_qty<=0 THEN EXIT; END IF;
      v_reserve_qty:=LEAST(v_lot.available,v_needed_qty);
      INSERT INTO inventory_lot_reservations(clinic_id,order_id,order_item_id,inventory_item_id,inventory_lot_id,reserved_quantity,consumed_quantity,unit,status,reserved_by,expires_at) VALUES(v_clinic_id,p_order_id,v_item.item_id,v_item.inventory_item_id,v_lot.id,v_reserve_qty,0,v_item.unit,'ACTIVE',v_user_id,NOW()+INTERVAL'30 days') RETURNING id INTO v_reservation_id;
      UPDATE lotes SET quantidade_reservada=quantidade_reservada+v_reserve_qty WHERE id=v_lot.id;
      v_needed_qty:=v_needed_qty-v_reserve_qty;
    END LOOP;
    IF v_needed_qty>0 THEN v_all_available:=FALSE; v_missing_items:=array_append(v_missing_items,v_item.item_id::TEXT); END IF;
  END LOOP;
  IF v_all_available THEN UPDATE compounding_orders SET status='STOCK_RESERVED' WHERE id=p_order_id; INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'STOCK_RESERVED',v_user_id,'Estoque reservado');
  ELSE UPDATE compounding_orders SET status='MISSING_STOCK' WHERE id=p_order_id; INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'MISSING_STOCK',v_user_id,'Itens faltantes: '||array_to_string(v_missing_items,', '));
  END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:=CASE WHEN v_all_available THEN 'STOCK_RESERVED' ELSE 'STOCK_MISSING' END,p_entity_type:='inventory_lot_reservations',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('all_available',v_all_available,'missing_items',v_missing_items));
  RETURN p_order_id;
END; $$;

-- 7. release_expired_reservation
CREATE OR REPLACE FUNCTION public.release_expired_reservation(p_reservation_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_res RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'release_expired: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','estoquista') THEN RAISE EXCEPTION 'release_expired: permissao negada'; END IF;
  SELECT * INTO v_res FROM inventory_lot_reservations WHERE id=p_reservation_id;
  IF v_res.id IS NULL THEN RAISE EXCEPTION 'release_expired: reserva nao encontrada'; END IF;
  IF v_res.status='EXPIRED' THEN RETURN p_reservation_id; END IF;
  IF v_res.status!='ACTIVE' THEN RAISE EXCEPTION 'release_expired: reserva nao ativa %',v_res.status; END IF;
  PERFORM id FROM lotes WHERE id=v_res.inventory_lot_id FOR UPDATE;
  UPDATE lotes SET quantidade_reservada=GREATEST(quantidade_reservada-v_res.reserved_quantity,0) WHERE id=v_res.inventory_lot_id;
  UPDATE inventory_lot_reservations SET status='EXPIRED',released_at=NOW(),release_reason='Expirada automaticamente' WHERE id=p_reservation_id;
  PERFORM log_compounding_audit(p_clinic_id:=v_res.clinic_id,p_order_id:=v_res.order_id,p_event_type:='RESERVATION_EXPIRED',p_entity_type:='inventory_lot_reservations',p_entity_id:=p_reservation_id,p_new_data:=jsonb_build_object('reserved_quantity',v_res.reserved_quantity));
  RETURN p_reservation_id;
END; $$;

-- 8. start_separation
CREATE OR REPLACE FUNCTION public.start_separation(p_order_id UUID,p_manipulator_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID; v_manip_role TEXT;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'start_separation: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'start_separation: permissao negada'; END IF;
  SELECT role INTO v_manip_role FROM profiles WHERE id=p_manipulator_id;
  IF v_manip_role IS NULL OR v_manip_role NOT IN ('manipulador','farmaceutico','administrador') THEN RAISE EXCEPTION 'start_separation: manipulador invalido'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'start_separation: ordem nao encontrada'; END IF;
  IF v_current_status='IN_SEPARATION' THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('STOCK_RESERVED','QUEUED_FOR_PRODUCTION') THEN RAISE EXCEPTION 'start_separation: status invalido %',v_current_status; END IF;
  UPDATE compounding_orders SET status='IN_SEPARATION',assigned_manipulator_id=p_manipulator_id,scheduled_start_at=COALESCE(scheduled_start_at,NOW()) WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'IN_SEPARATION',v_user_id,'Separacao iniciada');
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='SEPARATION_STARTED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('manipulator_id',p_manipulator_id));
  RETURN p_order_id;
END; $$;

-- 9. confirm_separation
CREATE OR REPLACE FUNCTION public.confirm_separation(p_separation_id UUID,p_checked_by UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_sep RECORD; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'confirm_separation: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'confirm_separation: permissao negada farmaceutico'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=p_checked_by;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'confirm_separation: checked_by invalido'; END IF;
  SELECT cs.*,co.clinic_id INTO v_sep FROM compounding_separations cs JOIN compounding_orders co ON co.id=cs.order_id WHERE cs.id=p_separation_id;
  IF v_sep.id IS NULL THEN RAISE EXCEPTION 'confirm_separation: separacao nao encontrada'; END IF;
  IF v_sep.status='CHECKED' THEN RETURN p_separation_id; END IF;
  IF v_sep.status NOT IN ('PENDING','SEPARATED') THEN RAISE EXCEPTION 'confirm_separation: status invalido %',v_sep.status; END IF;
  UPDATE compounding_separations SET status='CHECKED',checked_by=p_checked_by,checked_at=NOW() WHERE id=p_separation_id;
  PERFORM log_compounding_audit(p_clinic_id:=v_sep.clinic_id,p_order_id:=v_sep.order_id,p_event_type:='SEPARATION_CHECKED',p_entity_type:='compounding_separations',p_entity_id:=p_separation_id);
  RETURN p_separation_id;
END; $$;

-- 10. register_weighing
CREATE OR REPLACE FUNCTION public.register_weighing(p_order_item_id UUID,p_reservation_id UUID,p_sequence INTEGER,p_theoretical_qty NUMERIC,p_actual_qty NUMERIC,p_unit TEXT,p_allowed_min NUMERIC DEFAULT NULL,p_allowed_max NUMERIC DEFAULT NULL,p_container_tare NUMERIC DEFAULT NULL,p_gross_weight NUMERIC DEFAULT NULL,p_equipment_id UUID DEFAULT NULL,p_notes TEXT DEFAULT NULL)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_order_id UUID; v_clinic_id UUID; v_weighing_id UUID; v_net_weight NUMERIC; v_status weighing_status; v_item RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'register_weighing: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'register_weighing: permissao negada'; END IF;
  SELECT coi.*,co.clinic_id,co.id AS ord_id INTO v_item FROM compounding_order_items coi JOIN compounding_orders co ON co.id=coi.order_id WHERE coi.id=p_order_item_id;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'register_weighing: item nao encontrado'; END IF;
  v_order_id:=v_item.ord_id; v_clinic_id:=v_item.clinic_id;
  IF p_gross_weight IS NOT NULL AND p_container_tare IS NOT NULL THEN v_net_weight:=p_gross_weight-p_container_tare; ELSE v_net_weight:=p_actual_qty; END IF;
  IF p_allowed_min IS NOT NULL AND p_allowed_max IS NOT NULL THEN v_status:=CASE WHEN v_net_weight>=p_allowed_min AND v_net_weight<=p_allowed_max THEN 'RECORDED' ELSE 'REJECTED' END; ELSE v_status:='RECORDED'; END IF;
  INSERT INTO compounding_weighings(order_id,order_item_id,reservation_id,sequence,theoretical_quantity,actual_quantity,unit,allowed_minimum,allowed_maximum,container_tare,gross_weight,net_weight,equipment_id,weighed_by,status,notes) VALUES(v_order_id,p_order_item_id,p_reservation_id,p_sequence,p_theoretical_qty,p_actual_qty,p_unit,p_allowed_min,p_allowed_max,p_container_tare,p_gross_weight,v_net_weight,p_equipment_id,v_user_id,v_status,p_notes) RETURNING id INTO v_weighing_id;
  IF v_status='REJECTED' THEN INSERT INTO compounding_deviations(order_id,deviation_type,severity,description,detected_by,detected_at,status) VALUES(v_order_id,'WEIGHING_OUT_OF_TOLERANCE','MEDIUM','Pesagem fora tolerancia: teor='||p_theoretical_qty||', real='||v_net_weight,v_user_id,NOW(),'OPEN'); END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=v_order_id,p_event_type:=CASE WHEN v_status='RECORDED' THEN 'WEIGHING_RECORDED' ELSE 'WEIGHING_REJECTED' END,p_entity_type:='compounding_weighings',p_entity_id:=v_weighing_id);
  RETURN v_weighing_id;
END; $$;

-- 11. complete_weighing
CREATE OR REPLACE FUNCTION public.complete_weighing(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID; v_total_items INTEGER; v_weighed_items INTEGER; v_rejected_items INTEGER;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'complete_weighing: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'complete_weighing: permissao negada farmaceutico'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'complete_weighing: ordem nao encontrada'; END IF;
  IF v_current_status IN ('IN_COMPOUNDING','IN_PROCESS_CONTROL','AWAITING_PACKAGING','IN_PACKAGING','AWAITING_LABELING','IN_LABELING','PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUARANTINED','AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','DISPENSED') THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('AWAITING_WEIGHING','IN_WEIGHING') THEN RAISE EXCEPTION 'complete_weighing: status invalido %',v_current_status; END IF;
  SELECT COUNT(*) INTO v_total_items FROM compounding_order_items WHERE order_id=p_order_id;
  SELECT COUNT(DISTINCT order_item_id) INTO v_weighed_items FROM compounding_weighings WHERE order_id=p_order_id AND status='RECORDED';
  SELECT COUNT(DISTINCT order_item_id) INTO v_rejected_items FROM compounding_weighings WHERE order_id=p_order_id AND status='REJECTED';
  IF v_weighed_items<v_total_items THEN RAISE EXCEPTION 'complete_weighing: % de % pesados',v_weighed_items,v_total_items; END IF;
  IF v_rejected_items>0 THEN RAISE EXCEPTION 'complete_weighing: % itens rejeitados',v_rejected_items; END IF;
  UPDATE compounding_orders SET status='IN_COMPOUNDING' WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'IN_COMPOUNDING',v_user_id,'Pesagem concluida');
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='WEIGHING_COMPLETED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('total_items',v_total_items,'weighed_items',v_weighed_items));
  RETURN p_order_id;
END; $$;

-- 12. start_compounding_step
CREATE OR REPLACE FUNCTION public.start_compounding_step(p_step_id UUID,p_user_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_auth_u UUID; v_role TEXT; v_step RECORD; v_clinic_id UUID; v_step_role TEXT;
BEGIN
  v_auth_u:=auth.uid(); IF v_auth_u IS NULL THEN RAISE EXCEPTION 'start_step: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_auth_u;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'start_step: permissao negada'; END IF;
  SELECT role INTO v_step_role FROM profiles WHERE id=p_user_id;
  IF v_step_role IS NULL OR v_step_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'start_step: usuario invalido'; END IF;
  SELECT cs.*,co.clinic_id INTO v_step FROM compounding_steps cs JOIN compounding_orders co ON co.id=cs.order_id WHERE cs.id=p_step_id;
  IF v_step.id IS NULL THEN RAISE EXCEPTION 'start_step: etapa nao encontrada'; END IF;
  IF v_step.status='IN_PROGRESS' THEN RETURN p_step_id; END IF;
  IF v_step.status!='PENDING' THEN RAISE EXCEPTION 'start_step: status % invalido',v_step.status; END IF;
  UPDATE compounding_steps SET status='IN_PROGRESS',started_by=p_user_id,started_at=NOW() WHERE id=p_step_id;
  PERFORM log_compounding_audit(p_clinic_id:=v_step.clinic_id,p_order_id:=v_step.order_id,p_event_type:='STEP_STARTED',p_entity_type:='compounding_steps',p_entity_id:=p_step_id,p_new_data:=jsonb_build_object('started_by',p_user_id));
  RETURN p_step_id;
END; $$;

-- 13. complete_compounding_step
CREATE OR REPLACE FUNCTION public.complete_compounding_step(p_step_id UUID,p_measured_values JSONB DEFAULT NULL,p_equipment_data JSONB DEFAULT NULL,p_environment_data JSONB DEFAULT NULL,p_notes TEXT DEFAULT NULL)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_step RECORD; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'complete_step: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','manipulador') THEN RAISE EXCEPTION 'complete_step: permissao negada'; END IF;
  SELECT cs.*,co.clinic_id INTO v_step FROM compounding_steps cs JOIN compounding_orders co ON co.id=cs.order_id WHERE cs.id=p_step_id;
  IF v_step.id IS NULL THEN RAISE EXCEPTION 'complete_step: etapa nao encontrada'; END IF;
  IF v_step.status='COMPLETED' THEN RETURN p_step_id; END IF;
  IF v_step.status!='IN_PROGRESS' THEN RAISE EXCEPTION 'complete_step: status % nao esta em andamento',v_step.status; END IF;
  UPDATE compounding_steps SET status='COMPLETED',completed_by=v_user_id,completed_at=NOW(),measured_values=COALESCE(p_measured_values,measured_values),equipment_data=COALESCE(p_equipment_data,equipment_data),environment_data=COALESCE(p_environment_data,environment_data),notes=COALESCE(p_notes,notes) WHERE id=p_step_id;
  PERFORM log_compounding_audit(p_clinic_id:=v_step.clinic_id,p_order_id:=v_step.order_id,p_event_type:='STEP_COMPLETED',p_entity_type:='compounding_steps',p_entity_id:=p_step_id);
  RETURN p_step_id;
END; $$;

-- 14. complete_production
CREATE OR REPLACE FUNCTION public.complete_production(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
  v_total_steps INTEGER; v_completed_steps INTEGER; v_pending_steps INTEGER; v_open_critical INTEGER;
  v_lot_reservation RECORD; v_total_consumed NUMERIC; v_batch_number TEXT; v_movement_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'complete_production: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'complete_production: permissao negada farmaceutico'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'complete_production: ordem nao encontrada'; END IF;
  IF v_current_status IN ('PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUARANTINED','AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','DISPENSED') THEN RETURN p_order_id; END IF;
  SELECT COUNT(*) INTO v_total_steps FROM compounding_steps WHERE order_id=p_order_id;
  SELECT COUNT(*) INTO v_completed_steps FROM compounding_steps WHERE order_id=p_order_id AND status='COMPLETED';
  SELECT COUNT(*) INTO v_pending_steps FROM compounding_steps WHERE order_id=p_order_id AND status IN ('PENDING','IN_PROGRESS');
  IF v_completed_steps=0 THEN RAISE EXCEPTION 'complete_production: nenhuma etapa concluida'; END IF;
  IF v_pending_steps>0 THEN RAISE EXCEPTION 'complete_production: % etapas pendentes',v_pending_steps; END IF;
  IF EXISTS(SELECT 1 FROM compounding_order_items coi WHERE coi.order_id=p_order_id AND NOT EXISTS(SELECT 1 FROM compounding_weighings cw WHERE cw.order_item_id=coi.id AND cw.status IN ('RECORDED','VERIFIED'))) THEN RAISE EXCEPTION 'complete_production: itens sem pesagem'; END IF;
  SELECT COUNT(*) INTO v_open_critical FROM compounding_deviations WHERE order_id=p_order_id AND status IN ('OPEN','INVESTIGATION') AND severity='CRITICAL';
  IF v_open_critical>0 THEN RAISE EXCEPTION 'complete_production: % deviacoes criticas',v_open_critical; END IF;
  v_batch_number:='BAT-'||TO_CHAR(NOW(),'YYYYMMDD')||'-'||LPAD((SELECT COALESCE(MAX(SPLIT_PART(COALESCE(final_batch_number,'BAT-00000000-0000'),'-',3)::INTEGER),0)+1 FROM compounding_orders WHERE final_batch_number LIKE 'BAT-'||TO_CHAR(NOW(),'YYYYMMDD')||'-%')::TEXT,4,'0');
  FOR v_lot_reservation IN SELECT * FROM inventory_lot_reservations WHERE order_id=p_order_id AND status IN ('ACTIVE','PARTIALLY_CONSUMED') LOOP
    SELECT COALESCE(SUM(cw.actual_quantity),0) INTO v_total_consumed FROM compounding_weighings cw WHERE cw.reservation_id=v_lot_reservation.id AND cw.status IN ('RECORDED','VERIFIED');
    IF v_total_consumed=0 THEN v_total_consumed:=v_lot_reservation.reserved_quantity; END IF;
    UPDATE inventory_lot_reservations SET consumed_quantity=v_total_consumed,status=CASE WHEN v_total_consumed>=v_lot_reservation.reserved_quantity THEN 'CONSUMED' WHEN v_total_consumed>0 THEN 'PARTIALLY_CONSUMED' ELSE 'RELEASED' END WHERE id=v_lot_reservation.id;
    UPDATE compounding_order_items SET actual_consumed_quantity=actual_consumed_quantity+v_total_consumed WHERE id=v_lot_reservation.order_item_id;
    INSERT INTO inventory_movements(clinic_id,produto_id,lote_id,movement_type,quantity,unit,reference_type,reference_id,reason,created_by) VALUES(v_clinic_id,v_lot_reservation.inventory_item_id,v_lot_reservation.inventory_lot_id,'PRODUCTION_CONSUMPTION',v_total_consumed,v_lot_reservation.unit,'compounding_orders',p_order_id,'Consumo producao',v_user_id) RETURNING id INTO v_movement_id;
    UPDATE lotes SET quantidade=GREATEST(quantidade-v_total_consumed,0),quantidade_reservada=GREATEST(quantidade_reservada-v_total_consumed,0) WHERE id=v_lot_reservation.inventory_lot_id;
  END LOOP;
  UPDATE compounding_orders SET status='PRODUCTION_COMPLETED',final_batch_number=v_batch_number,production_completed_at=NOW() WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'PRODUCTION_COMPLETED',v_user_id,'Producao concluida lote '||v_batch_number);
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='PRODUCTION_COMPLETED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('batch_number',v_batch_number,'completed_steps',v_completed_steps,'total_steps',v_total_steps));
  RETURN p_order_id;
END; $$;

-- 15. register_quality_result
CREATE OR REPLACE FUNCTION public.register_quality_result(p_order_id UUID,p_checks_json JSONB DEFAULT '[]',p_decision quality_decision DEFAULT 'APPROVED',p_notes TEXT DEFAULT NULL)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
  v_check JSONB; v_has_rejected_required BOOLEAN:=FALSE; v_actual_decision quality_decision; v_all_approved BOOLEAN:=TRUE; v_check_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'register_quality: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'register_quality: permissao negada farmaceutico'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'register_quality: ordem nao encontrada'; END IF;
  IF v_current_status IN ('AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','DISPENSED') THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUALITY_CONTROL_REJECTED','REWORK_REQUIRED') THEN RAISE EXCEPTION 'register_quality: status invalido %',v_current_status; END IF;
  FOR v_check IN SELECT * FROM jsonb_array_elements(p_checks_json) LOOP
    INSERT INTO compounding_quality_checks(order_id,check_stage,check_type,required,target_value,minimum_value,maximum_value,unit,result_value,result_status,method_reference,equipment_id,performed_by,performed_at,notes) VALUES(p_order_id,v_check->>'check_stage',v_check->>'check_type',COALESCE((v_check->>'required')::BOOLEAN,TRUE),v_check->>'target_value',(v_check->>'minimum_value')::NUMERIC,(v_check->>'maximum_value')::NUMERIC,v_check->>'unit',v_check->>'result_value',COALESCE((v_check->>'result_status')::quality_status,'APPROVED'),v_check->>'method_reference',(v_check->>'equipment_id')::UUID,v_user_id,NOW(),v_check->>'notes') RETURNING id INTO v_check_id;
    IF (v_check->>'required')::BOOLEAN IS NOT FALSE AND COALESCE((v_check->>'result_status')::quality_status,'APPROVED')='REJECTED' THEN v_has_rejected_required:=TRUE; END IF;
    IF COALESCE((v_check->>'result_status')::quality_status,'APPROVED')!='APPROVED' THEN v_all_approved:=FALSE; END IF;
  END LOOP;
  IF v_has_rejected_required THEN v_actual_decision:='REJECTED'; ELSIF v_all_approved THEN v_actual_decision:='APPROVED'; ELSE v_actual_decision:=p_decision; END IF;
  IF v_actual_decision='REJECTED' THEN
    UPDATE compounding_orders SET status='QUARANTINED' WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'QUARANTINED',v_user_id,'CQ rejeitado');
    INSERT INTO compounding_deviations(order_id,deviation_type,severity,description,detected_by,detected_at,status) VALUES(p_order_id,'QUALITY_CONTROL_REJECTED','HIGH','CQ rejeitado: '||COALESCE(p_notes,''),v_user_id,NOW(),'OPEN');
  ELSIF v_actual_decision IN ('APPROVED') THEN
    UPDATE compounding_orders SET status='AWAITING_PHARMACIST_RELEASE' WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'AWAITING_PHARMACIST_RELEASE',v_user_id,'CQ aprovado');
  ELSE
    UPDATE compounding_orders SET status=CASE v_actual_decision WHEN 'QUARANTINED' THEN 'QUARANTINED' WHEN 'REWORK_REQUIRED' THEN 'REWORK_REQUIRED' ELSE 'QUARANTINED' END WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,CASE v_actual_decision WHEN 'QUARANTINED' THEN 'QUARANTINED' WHEN 'REWORK_REQUIRED' THEN 'REWORK_REQUIRED' ELSE 'QUARANTINED' END,v_user_id,'CQ: '||v_actual_decision::TEXT);
  END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='QUALITY_CONTROL_'||v_actual_decision::TEXT,p_entity_type:='compounding_quality_checks',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('decision',v_actual_decision,'checks_count',jsonb_array_length(p_checks_json)));
  RETURN p_order_id;
END; $$;

-- 16. quarantine_order
CREATE OR REPLACE FUNCTION public.quarantine_order(p_order_id UUID,p_reason TEXT,p_pharmacist_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID; v_deviation_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'quarantine: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'quarantine: permissao negada farmaceutico'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=p_pharmacist_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'quarantine: farmaceutico invalido'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'quarantine: ordem nao encontrada'; END IF;
  IF v_current_status='QUARANTINED' THEN RETURN p_order_id; END IF;
  UPDATE compounding_orders SET status='QUARANTINED' WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'QUARANTINED',v_user_id,'Quarentena: '||p_reason);
  INSERT INTO compounding_deviations(order_id,deviation_type,severity,description,detected_by,detected_at,status) VALUES(p_order_id,'QUARANTINE','HIGH','Ordem quarentena: '||p_reason,p_pharmacist_id,NOW(),'OPEN') RETURNING id INTO v_deviation_id;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='ORDER_QUARANTINED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('reason',p_reason,'pharmacist_id',p_pharmacist_id,'deviation_id',v_deviation_id));
  RETURN p_order_id;
END; $$;

-- 17. sign_pharmacist_release
CREATE OR REPLACE FUNCTION public.sign_pharmacist_release(p_order_id UUID,p_pharmacist_name TEXT,p_crf_number TEXT,p_crf_state TEXT,p_signature_method signature_method DEFAULT 'ADVANCED_ELECTRONIC_SIGNATURE',p_decision release_decision DEFAULT 'APPROVED',p_notes TEXT DEFAULT NULL,p_certificate_subject TEXT DEFAULT NULL,p_certificate_issuer TEXT DEFAULT NULL)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
  v_open_critical INTEGER; v_release_id UUID;
  v_order_hash TEXT; v_production_hash TEXT; v_quality_hash TEXT; v_release_hash TEXT;
  v_release_data TEXT;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'sign_release: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'sign_release: permissao negada farmaceutico'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'sign_release: ordem nao encontrada'; END IF;
  IF v_current_status='RELEASED_BY_PHARMACIST' THEN SELECT id INTO v_release_id FROM compounding_releases WHERE order_id=p_order_id ORDER BY created_at DESC LIMIT 1; RETURN COALESCE(v_release_id,p_order_id); END IF;
  IF v_current_status!='AWAITING_PHARMACIST_RELEASE' THEN RAISE EXCEPTION 'sign_release: status invalido %',v_current_status; END IF;
  IF EXISTS(SELECT 1 FROM compounding_quality_checks WHERE order_id=p_order_id AND required=TRUE AND result_status NOT IN ('APPROVED','NOT_APPLICABLE')) THEN RAISE EXCEPTION 'sign_release: checks obrigatorios pendentes'; END IF;
  SELECT COUNT(*) INTO v_open_critical FROM compounding_deviations WHERE order_id=p_order_id AND status IN ('OPEN','INVESTIGATION') AND severity='CRITICAL';
  IF v_open_critical>0 THEN RAISE EXCEPTION 'sign_release: % deviacoes criticas',v_open_critical; END IF;
  SELECT encode(sha256((SELECT row_to_json(c)::text FROM (SELECT id,internal_number,patient_id,pharmaceutical_form,requested_quantity,requested_unit,status,priority,created_at,production_completed_at FROM compounding_orders WHERE id=p_order_id) c)::bytea),'hex') INTO v_order_hash;
  SELECT encode(sha256(COALESCE((SELECT string_agg(row_to_json(s)::text,'|' ORDER BY s.sequence) FROM (SELECT sequence,step_type,status,started_at,completed_at,measured_values,equipment_data,environment_data FROM compounding_steps WHERE order_id=p_order_id) s),'')::bytea),'hex') INTO v_production_hash;
  SELECT encode(sha256(COALESCE((SELECT string_agg(row_to_json(q)::text,'|' ORDER BY q.check_type) FROM (SELECT check_stage,check_type,required,result_value,result_status,performed_at,method_reference FROM compounding_quality_checks WHERE order_id=p_order_id) q),'')::bytea),'hex') INTO v_quality_hash;
  v_release_data:=jsonb_build_object('order_id',p_order_id,'pharmacist_id',v_user_id,'pharmacist_name',p_pharmacist_name,'crf_number',p_crf_number,'crf_state',p_crf_state,'decision',p_decision,'signature_method',p_signature_method,'signed_at',NOW())::text;
  v_release_hash:=encode(sha256(v_release_data::bytea),'hex');
  INSERT INTO compounding_releases(order_id,pharmacist_id,pharmacist_name,crf_number,crf_state,decision,notes,signature_method,signature_status,order_hash,production_record_hash,quality_record_hash,release_record_hash,certificate_subject,certificate_issuer,signed_at) VALUES(p_order_id,v_user_id,p_pharmacist_name,p_crf_number,p_crf_state,p_decision,p_notes,p_signature_method,'COMPLETED',v_order_hash,v_production_hash,v_quality_hash,v_release_hash,p_certificate_subject,p_certificate_issuer,NOW()) RETURNING id INTO v_release_id;
  IF p_decision='APPROVED' THEN
    UPDATE compounding_orders SET status='RELEASED_BY_PHARMACIST',released_at=NOW() WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'RELEASED_BY_PHARMACIST',v_user_id,'Liberacao farmaceutica concedida');
  ELSE
    UPDATE compounding_orders SET status='RELEASE_REJECTED' WHERE id=p_order_id;
    INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'RELEASE_REJECTED',v_user_id,'Liberacao rejeitada');
    INSERT INTO compounding_deviations(order_id,deviation_type,severity,description,detected_by,detected_at,status) VALUES(p_order_id,'RELEASE_REJECTED','HIGH','Liberacao rejeitada: '||COALESCE(p_notes,''),v_user_id,NOW(),'OPEN');
  END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:=CASE WHEN p_decision='APPROVED' THEN 'PHARMACIST_RELEASE_SIGNED' ELSE 'PHARMACIST_RELEASE_REJECTED' END,p_entity_type:='compounding_releases',p_entity_id:=v_release_id,p_new_data:=jsonb_build_object('decision',p_decision,'pharmacist_name',p_pharmacist_name));
  RETURN v_release_id;
END; $$;

-- 18. mark_ready_for_pickup
CREATE OR REPLACE FUNCTION public.mark_ready_for_pickup(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'mark_ready: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','atendente') THEN RAISE EXCEPTION 'mark_ready: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'mark_ready: ordem nao encontrada'; END IF;
  IF v_current_status IN ('READY_FOR_PICKUP','OUT_FOR_DELIVERY','DISPENSED') THEN RETURN p_order_id; END IF;
  IF v_current_status!='RELEASED_BY_PHARMACIST' THEN RAISE EXCEPTION 'mark_ready: status invalido %',v_current_status; END IF;
  UPDATE compounding_orders SET status='READY_FOR_PICKUP',ready_at=NOW() WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'READY_FOR_PICKUP',v_user_id,'Disponivel para retirada');
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='ORDER_READY_FOR_PICKUP',p_entity_type:='compounding_orders',p_entity_id:=p_order_id);
  RETURN p_order_id;
END; $$;

-- 19. mark_as_dispensed
CREATE OR REPLACE FUNCTION public.mark_as_dispensed(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'mark_dispensed: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico','atendente') THEN RAISE EXCEPTION 'mark_dispensed: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'mark_dispensed: ordem nao encontrada'; END IF;
  IF v_current_status='DISPENSED' THEN RETURN p_order_id; END IF;
  IF v_current_status NOT IN ('READY_FOR_PICKUP','OUT_FOR_DELIVERY') THEN RAISE EXCEPTION 'mark_dispensed: status invalido %',v_current_status; END IF;
  UPDATE compounding_orders SET status='DISPENSED',dispensed_at=NOW() WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'DISPENSED',v_user_id,'Entregue ao paciente');
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='ORDER_DISPENSED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id);
  RETURN p_order_id;
END; $$;

-- 20. cancel_compounding_order
CREATE OR REPLACE FUNCTION public.cancel_compounding_order(p_order_id UUID,p_reason TEXT,p_after_weighing BOOLEAN DEFAULT FALSE)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID; v_reservation RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'cancel: nao autenticado'; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'cancel: permissao negada farmaceutico'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'cancel: ordem nao encontrada'; END IF;
  IF v_current_status IN ('CANCELLED','DESTROYED') THEN RETURN p_order_id; END IF;
  IF v_current_status IN ('DISPENSED','RELEASED_BY_PHARMACIST') AND NOT p_after_weighing THEN RAISE EXCEPTION 'cancel: ja dispensada use p_after_weighing=true'; END IF;
  IF NOT p_after_weighing THEN
    FOR v_reservation IN SELECT * FROM inventory_lot_reservations WHERE order_id=p_order_id AND status='ACTIVE' FOR UPDATE LOOP
      PERFORM id FROM lotes WHERE id=v_reservation.inventory_lot_id FOR UPDATE;
      UPDATE lotes SET quantidade_reservada=GREATEST(quantidade_reservada-v_reservation.reserved_quantity,0) WHERE id=v_reservation.inventory_lot_id;
      UPDATE inventory_lot_reservations SET status='CANCELLED',released_at=NOW(),release_reason='Cancelamento: '||p_reason WHERE id=v_reservation.id;
    END LOOP;
  END IF;
  UPDATE compounding_orders SET status='CANCELLED',cancellation_reason=p_reason WHERE id=p_order_id;
  INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'CANCELLED',v_user_id,'Cancelamento: '||p_reason);
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:='ORDER_CANCELLED',p_entity_type:='compounding_orders',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('reason',p_reason,'after_weighing',p_after_weighing,'previous_status',v_current_status));
  RETURN p_order_id;
END; $$;

-- 21. Permissions
GRANT EXECUTE ON FUNCTION public.log_compounding_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_compounding_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pharmaceutical_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_stock_availability TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_inventory_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_reservation TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_separation TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_separation TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_weighing TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_weighing TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_compounding_step TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_compounding_step TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_production TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_quality_result TO authenticated;
GRANT EXECUTE ON FUNCTION public.quarantine_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_pharmacist_release TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_pickup TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_as_dispensed TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_compounding_order TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;

-- ============================================================
-- PARTE 2: 007_fix_stock_functions
-- Sobrescreve reserve_inventory_for_order
-- ============================================================

-- reserve_inventory_for_order (FIXED)
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_order(p_order_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_user_role TEXT; v_current_status compounding_order_status; v_clinic_id UUID;
  v_item RECORD; v_needed_qty NUMERIC; v_lot RECORD; v_reserve_qty NUMERIC;
  v_all_available BOOLEAN:=TRUE; v_missing_items TEXT[]:='{}'; v_reservation_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT role INTO v_user_role FROM profiles WHERE id=v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'reserve_inventory: permissao negada'; END IF;
  SELECT status,clinic_id INTO v_current_status,v_clinic_id FROM compounding_orders WHERE id=p_order_id;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'reserve_inventory: ordem nao encontrada'; END IF;
  IF v_current_status IN ('STOCK_RESERVED','QUEUED_FOR_PRODUCTION','IN_SEPARATION','AWAITING_WEIGHING','IN_WEIGHING','IN_COMPOUNDING','IN_PROCESS_CONTROL','AWAITING_PACKAGING','IN_PACKAGING','AWAITING_LABELING','IN_LABELING','PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUARANTINED','AWAITING_PHARMACIST_RELEASE','RELEASED_BY_PHARMACIST','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DISPENSED') THEN RETURN p_order_id; END IF;
  FOR v_item IN SELECT coi.id AS item_id,coi.inventory_item_id,coi.total_required_quantity,coi.unit FROM compounding_order_items coi WHERE coi.order_id=p_order_id ORDER BY coi.sequence LOOP
    v_needed_qty:=v_item.total_required_quantity;
    FOR v_lot IN SELECT l.id,l.quantidade_disponivel AS quantidade_disponivel,l.numero_lote FROM lotes l WHERE l.produto_id=v_item.inventory_item_id AND l.status='APPROVED' AND (l.data_validade IS NULL OR l.data_validade>=CURRENT_DATE) AND l.quantidade_disponivel>0 ORDER BY l.data_validade ASC NULLS LAST,l.data_recebimento ASC NULLS LAST,l.id ASC FOR UPDATE OF lotes LOOP
      IF v_needed_qty<=0 THEN EXIT; END IF;
      v_reserve_qty:=LEAST(v_lot.quantidade_disponivel,v_needed_qty);
      INSERT INTO inventory_lot_reservations(clinic_id,order_id,order_item_id,inventory_item_id,inventory_lot_id,reserved_quantity,consumed_quantity,unit,status,reserved_by,expires_at) VALUES(v_clinic_id,p_order_id,v_item.item_id,v_item.inventory_item_id,v_lot.id,v_reserve_qty,0,v_item.unit,'ACTIVE',v_user_id,NOW()+INTERVAL'30 days') RETURNING id INTO v_reservation_id;
      UPDATE lotes SET quantidade_reservada=COALESCE(quantidade_reservada,0)+v_reserve_qty,quantidade_disponivel=quantidade_disponivel-v_reserve_qty WHERE id=v_lot.id;
      v_needed_qty:=v_needed_qty-v_reserve_qty;
    END LOOP;
    IF v_needed_qty>0 THEN v_all_available:=FALSE; v_missing_items:=array_append(v_missing_items,v_item.item_id::TEXT); END IF;
  END LOOP;
  IF v_all_available THEN UPDATE compounding_orders SET status='STOCK_RESERVED' WHERE id=p_order_id; INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'STOCK_RESERVED',v_user_id,'Estoque reservado');
  ELSE UPDATE compounding_orders SET status='MISSING_STOCK' WHERE id=p_order_id; INSERT INTO compounding_status_history(clinic_id,order_id,previous_status,new_status,changed_by,reason) VALUES(v_clinic_id,p_order_id,v_current_status::TEXT,'MISSING_STOCK',v_user_id,'Itens faltantes: '||array_to_string(v_missing_items,', ')); END IF;
  PERFORM log_compounding_audit(p_clinic_id:=v_clinic_id,p_order_id:=p_order_id,p_event_type:=CASE WHEN v_all_available THEN 'STOCK_RESERVED' ELSE 'STOCK_MISSING' END,p_entity_type:='inventory_lot_reservations',p_entity_id:=p_order_id,p_new_data:=jsonb_build_object('all_available',v_all_available));
  RETURN p_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.reserve_inventory_for_order TO authenticated;

-- ============================================================
-- PARTE 3: 008_fix_fefo_rpc
-- ============================================================

-- consumir_fefo()
CREATE OR REPLACE FUNCTION public.consumir_fefo(p_produto_id UUID,p_quantidade NUMERIC,p_ordem_id UUID DEFAULT NULL,p_movimento_tipo TEXT DEFAULT 'PRODUCTION_CONSUMPTION',p_user_id UUID DEFAULT NULL)
RETURNS JSONB SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_lote RECORD; v_restante NUMERIC:=p_quantidade; v_consumido NUMERIC; v_lotes_afetados JSONB:='[]'::JSONB; v_mov_id UUID;
BEGIN
  v_user_id:=COALESCE(p_user_id,auth.uid());
  FOR v_lote IN SELECT l.id,l.quantidade_disponivel,l.numero_lote,l.data_validade FROM lotes l WHERE l.produto_id=p_produto_id AND l.status='APPROVED' AND (l.data_validade IS NULL OR l.data_validade>=CURRENT_DATE) AND l.quantidade_disponivel>0 ORDER BY l.data_validade ASC NULLS LAST,l.data_recebimento ASC NULLS LAST,l.id ASC FOR UPDATE OF lotes LOOP
    IF v_restante<=0 THEN EXIT; END IF;
    v_consumido:=LEAST(v_lote.quantidade_disponivel,v_restante);
    UPDATE lotes SET quantidade_disponivel=quantidade_disponivel-v_consumido,quantidade_reservada=GREATEST(COALESCE(quantidade_reservada,0)-v_consumido,0) WHERE id=v_lote.id;
    INSERT INTO movimentacoes(produto_id,lote_id,tipo_movimento,quantidade,saldo_anterior,saldo_atual,usuario_id,observacao,created_at) VALUES(p_produto_id,v_lote.id,'saida',v_consumido,v_lote.quantidade_disponivel+v_consumido,v_lote.quantidade_disponivel-v_consumido,v_user_id,'FEFO consumo'||COALESCE('-ordem:'||p_ordem_id,''),NOW());
    IF p_ordem_id IS NOT NULL THEN
      INSERT INTO inventory_movements(clinic_id,produto_id,lote_id,movement_type,quantity,reference_type,reference_id,reason,created_by) SELECT co.clinic_id,p_produto_id,v_lote.id,p_movimento_tipo::movement_type,v_consumido,'compounding_orders',p_ordem_id,'Consumo FEFO',v_user_id FROM compounding_orders co WHERE co.id=p_ordem_id RETURNING id INTO v_mov_id;
    END IF;
    v_lotes_afetados:=v_lotes_afetados||jsonb_build_object('lote_id',v_lote.id,'numero_lote',v_lote.numero_lote,'consumido',v_consumido);
    v_restante:=v_restante-v_consumido;
  END LOOP;
  RETURN jsonb_build_object('produto_id',p_produto_id,'quantidade_solicitada',p_quantidade,'quantidade_consumida',p_quantidade-v_restante,'restante',v_restante,'total_atendido',v_restante<=0,'lotes',v_lotes_afetados);
END; $$;
GRANT EXECUTE ON FUNCTION public.consumir_fefo TO authenticated;

-- ============================================================
-- PARTE 4: 009_alertas_auto
-- ============================================================

-- gerar_alertas_estoque()
CREATE OR REPLACE FUNCTION public.gerar_alertas_estoque()
RETURNS INTEGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER:=0; v_prod RECORD; v_lote RECORD;
BEGIN
  -- Alertas de estoque minimo
  FOR v_prod IN SELECT id,nome,estoque_minimo,saldo_atual FROM produtos WHERE COALESCE(estoque_minimo,0)>0 AND COALESCE(saldo_atual,0)<COALESCE(estoque_minimo,0) LOOP
    INSERT INTO alertas(produto_id,tipo,mensagem,created_at) VALUES(v_prod.id,'estoque_baixo','Produto '||v_prod.nome||' com estoque baixo: '||COALESCE(v_prod.saldo_atual::TEXT,'0')||' (minimo: '||v_prod.estoque_minimo||')',NOW()) ON CONFLICT DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  -- Alertas de lote proximo a vencer (30 dias)
  FOR v_lote IN SELECT l.id,l.numero_lote,l.data_validade,p.nome AS produto_nome,p.id AS produto_id FROM lotes l JOIN produtos p ON p.id=l.produto_id WHERE l.data_validade IS NOT NULL AND l.data_validade<=CURRENT_DATE+INTERVAL'30 days' AND l.data_validade>=CURRENT_DATE AND l.quantidade_disponivel>0 LOOP
    INSERT INTO alertas(produto_id,lote_id,tipo,mensagem,created_at) VALUES(v_lote.produto_id,v_lote.id,'validade_proxima','Lote '||v_lote.numero_lote||' de '||v_lote.produto_nome||' vence em '||v_lote.data_validade||' ('||(v_lote.data_validade-CURRENT_DATE)||' dias)',NOW()) ON CONFLICT DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_estoque TO authenticated;

-- trig_gerar_alertas_lotes()
CREATE OR REPLACE FUNCTION public.trig_gerar_alertas_lotes()
RETURNS TRIGGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN PERFORM gerar_alertas_estoque(); RETURN NEW; END; $$;

-- trig_gerar_alertas_produtos()
CREATE OR REPLACE FUNCTION public.trig_gerar_alertas_produtos()
RETURNS TRIGGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN PERFORM gerar_alertas_estoque(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_gerar_alertas_lotes ON lotes;
CREATE TRIGGER trg_gerar_alertas_lotes AFTER INSERT OR UPDATE OF quantidade_disponivel,data_validade ON lotes FOR EACH ROW EXECUTE FUNCTION trig_gerar_alertas_lotes();

DROP TRIGGER IF EXISTS trg_gerar_alertas_produtos ON produtos;
CREATE TRIGGER trg_gerar_alertas_produtos AFTER INSERT OR UPDATE OF saldo_atual,estoque_minimo ON produtos FOR EACH ROW EXECUTE FUNCTION trig_gerar_alertas_produtos();

-- ============================================================
-- PARTE 5: 009_trigger_alertas (complementar)
-- ============================================================

-- gerar_alertas_trigger()
CREATE OR REPLACE FUNCTION public.gerar_alertas_trigger()
RETURNS TRIGGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM gerar_alertas_estoque();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_alertas_lotes ON lotes;
CREATE TRIGGER trg_alertas_lotes AFTER INSERT OR UPDATE ON lotes FOR EACH ROW EXECUTE FUNCTION gerar_alertas_trigger();

DROP TRIGGER IF EXISTS trg_alertas_produtos ON produtos;
CREATE TRIGGER trg_alertas_produtos AFTER INSERT OR UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION gerar_alertas_trigger();

DROP TRIGGER IF EXISTS trg_alertas_movimentacoes ON movimentacoes;
CREATE TRIGGER trg_alertas_movimentacoes AFTER INSERT ON movimentacoes FOR EACH ROW EXECUTE FUNCTION gerar_alertas_trigger();

-- ============================================================
-- FIM - TODAS AS MIGRATIONS PENDENTES
-- ============================================================
