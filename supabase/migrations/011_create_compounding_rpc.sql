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
