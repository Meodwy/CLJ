-- ============================================================
-- CLJ Clínica — Compounding RPC Functions
-- Migration 006_compounding_rpc.sql
-- ============================================================
-- Dependências: Migration 005_compounding_base.sql
--   (tabelas compounding_orders, compounding_formulas,
--    compounding_order_items, inventory_lot_reservations,
--    compounding_separations, compounding_weighings,
--    compounding_steps, compounding_quality_checks,
--    compounding_deviations, compounding_releases,
--    compounding_status_history, compounding_audit_logs,
--    enums e RLS)
-- ============================================================

-- ============================================================
-- 1. TABELA AUXILIAR: inventory_movements
-- Necessária para complete_production() registrar consumos.
-- O enum movement_type já foi criado na migration 005.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  produto_id UUID NOT NULL,
  lote_id UUID REFERENCES lotes(id),
  movement_type movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  reference_type TEXT,
  reference_id UUID,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref
  ON inventory_movements(reference_type, reference_id);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movements_select ON inventory_movements;
CREATE POLICY inventory_movements_select ON inventory_movements
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
DROP POLICY IF EXISTS inventory_movements_insert ON inventory_movements;
CREATE POLICY inventory_movements_insert ON inventory_movements
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','estoquista'));

-- ============================================================
-- 1b. GARANTIR COLUNAS NA TABELA lotes (se ainda não existirem)
-- ============================================================
ALTER TABLE lotes
  ADD COLUMN IF NOT EXISTS data_validade DATE,
  ADD COLUMN IF NOT EXISTS data_recebimento DATE,
  ADD COLUMN IF NOT EXISTS quantidade_reservada NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- 2. FUNÇÃO HELPER: log_compounding_audit
-- ============================================================
-- Todas as RPCs usam esta função para registrar auditoria
-- dentro da mesma transação.
CREATE OR REPLACE FUNCTION public.log_compounding_audit(
  p_clinic_id UUID,
  p_event_type TEXT,
  p_order_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_event_reason TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_previous_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_audit_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  INSERT INTO compounding_audit_logs (
    clinic_id, order_id, user_id, event_type, event_reason,
    entity_type, entity_id, previous_data, new_data, metadata
  ) VALUES (
    p_clinic_id, p_order_id, v_user_id, p_event_type, p_event_reason,
    p_entity_type, p_entity_id, p_previous_data, p_new_data, p_metadata
  )
  RETURNING id INTO v_audit_id;
  RETURN v_audit_id;
END;
$$;

-- ============================================================
-- 3. FUNÇÃO: create_compounding_order
-- ============================================================
-- Cria order + formula + items em uma transação.
-- Gera internal_number (CLJ-YYYY-NNNN).
-- Status inicial: DRAFT.
CREATE OR REPLACE FUNCTION public.create_compounding_order(
  p_clinic_id UUID,
  p_patient_id UUID,
  p_prescription_id UUID,
  p_prescription_version_id UUID,
  p_pharmaceutical_form TEXT,
  p_requested_quantity NUMERIC,
  p_requested_unit TEXT,
  p_priority priority_level DEFAULT 'NORMAL',
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_formula_data JSONB DEFAULT '{}',
  p_calculation_data JSONB DEFAULT '{}',
  p_items_json JSONB DEFAULT '[]'
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_order_id UUID;
  v_formula_id UUID;
  v_internal_number TEXT;
  v_year TEXT;
  v_sequence INTEGER;
  v_item JSONB;
  v_item_id UUID;
BEGIN
  -- 1. Validação de autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_compounding_order: usuário não autenticado';
  END IF;

  -- 2. Validação de role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'create_compounding_order: permissão negada (necessário administrador ou farmacêutico)';
  END IF;

  -- 3. Geração de internal_number
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(SPLIT_PART(internal_number, '-', 3)::INTEGER), 0) + 1
    INTO v_sequence
    FROM compounding_orders
    WHERE internal_number LIKE 'CLJ-' || v_year || '-%';
  v_internal_number := 'CLJ-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');

  -- 4. Transação principal
  BEGIN
    -- 4a. Criar order
    INSERT INTO compounding_orders (
      clinic_id, patient_id, prescription_id, prescription_version_id,
      internal_number, pharmaceutical_form, requested_quantity, requested_unit,
      status, priority, due_at, created_by
    ) VALUES (
      p_clinic_id, p_patient_id, p_prescription_id, p_prescription_version_id,
      v_internal_number, p_pharmaceutical_form, p_requested_quantity, p_requested_unit,
      'DRAFT', p_priority, p_due_at, v_user_id
    )
    RETURNING id INTO v_order_id;

    -- 4b. Criar formula (versão 1)
    INSERT INTO compounding_formulas (
      order_id, version_number, status, formula_data, calculation_data, created_by
    ) VALUES (
      v_order_id, 1, 'DRAFT', p_formula_data, p_calculation_data, v_user_id
    )
    RETURNING id INTO v_formula_id;

    -- 4c. Criar itens
    IF jsonb_array_length(p_items_json) = 0 THEN
      RAISE EXCEPTION 'create_compounding_order: ao menos um item deve ser informado';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json)
    LOOP
      INSERT INTO compounding_order_items (
        order_id, formula_id,
        inventory_item_id, item_type,
        theoretical_quantity, technical_margin_quantity, total_required_quantity, unit,
        sequence
      ) VALUES (
        v_order_id, v_formula_id,
        (v_item->>'inventory_item_id')::UUID,
        (v_item->>'item_type')::item_type,
        (v_item->>'theoretical_quantity')::NUMERIC,
        COALESCE((v_item->>'technical_margin_quantity')::NUMERIC, 0),
        COALESCE((v_item->>'total_required_quantity')::NUMERIC, (v_item->>'theoretical_quantity')::NUMERIC),
        v_item->>'unit',
        COALESCE((v_item->>'sequence')::INTEGER, 1)
      );
    END LOOP;

    -- 4d. Status history
    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (p_clinic_id, v_order_id, NULL, 'DRAFT', v_user_id, 'Ordem de manipulação criada');

    -- 4e. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := p_clinic_id,
      p_order_id := v_order_id,
      p_event_type := 'COMPOUNDING_ORDER_CREATED',
      p_entity_type := 'compounding_orders',
      p_entity_id := v_order_id,
      p_new_data := jsonb_build_object(
        'internal_number', v_internal_number,
        'formula_id', v_formula_id
      )
    );

    RETURN v_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 4. FUNÇÃO: submit_pharmaceutical_review
-- ============================================================
-- Submete revisão farmacêutica. Transiciona DRAFT ->
-- AWAITING_PHARMACEUTICAL_REVIEW -> APPROVED_FOR_PRODUCTION
-- ou PRESCRIPTION_REJECTED.
CREATE OR REPLACE FUNCTION public.submit_pharmaceutical_review(
  p_order_id UUID,
  p_checklist_json JSONB DEFAULT '{}',
  p_approved BOOLEAN DEFAULT TRUE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_new_status compounding_order_status;
  v_formula_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'submit_pharmaceutical_review: usuário não autenticado';
  END IF;

  -- 2. Role: apenas farmacêutico
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'submit_pharmaceutical_review: permissão negada (necessário farmacêutico)';
  END IF;

  -- 3. Carregar dados da ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'submit_pharmaceutical_review: ordem não encontrada';
  END IF;

  -- 4. Idempotency: se já estiver APPROVED_FOR_PRODUCTION ou PRESCRIPTION_REJECTED, retorna
  IF v_current_status IN ('APPROVED_FOR_PRODUCTION', 'PRESCRIPTION_REJECTED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite revisar a partir de DRAFT
  IF v_current_status NOT IN ('DRAFT', 'AWAITING_PHARMACEUTICAL_REVIEW') THEN
    RAISE EXCEPTION 'submit_pharmaceutical_review: status inválido (%) para revisão farmacêutica', v_current_status;
  END IF;

  -- 6. Determinar novo status
  IF p_approved THEN
    v_new_status := 'APPROVED_FOR_PRODUCTION';
  ELSE
    v_new_status := 'PRESCRIPTION_REJECTED';
  END IF;

  -- 7. Transação
  BEGIN
    -- 7a. Se ainda DRAFT, primeiro transiciona para AWAITING_PHARMACEUTICAL_REVIEW
    IF v_current_status = 'DRAFT' THEN
      UPDATE compounding_orders
        SET status = 'AWAITING_PHARMACEUTICAL_REVIEW',
            pharmacist_id = v_user_id
        WHERE id = p_order_id;

      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'AWAITING_PHARMACEUTICAL_REVIEW', v_user_id,
              'Encaminhado para revisão farmacêutica');
    END IF;

    -- 7b. Transiciona para aprovação/rejeição
    UPDATE compounding_orders
      SET status = v_new_status,
          pharmacist_id = v_user_id
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id,
            CASE WHEN v_current_status = 'DRAFT' THEN 'AWAITING_PHARMACEUTICAL_REVIEW' ELSE v_current_status::TEXT END,
            v_new_status::TEXT, v_user_id,
            CASE WHEN p_approved THEN 'Prescrição aprovada pelo farmacêutico' ELSE 'Prescrição rejeitada pelo farmacêutico' END);

    -- 7c. Atualizar status da formula
    SELECT id INTO v_formula_id FROM compounding_formulas WHERE order_id = p_order_id ORDER BY version_number DESC LIMIT 1;
    IF v_formula_id IS NOT NULL THEN
      UPDATE compounding_formulas
        SET status = CASE WHEN p_approved THEN 'APPROVED' ELSE 'REJECTED' END,
            approved_by = v_user_id,
            approved_at = NOW()
        WHERE id = v_formula_id;
    END IF;

    -- 7d. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'PHARMACEUTICAL_REVIEW',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'approved', p_approved,
        'notes', p_notes,
        'checklist', p_checklist_json,
        'formula_id', v_formula_id
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 5. FUNÇÃO: check_stock_availability
-- ============================================================
-- Read-only. Retorna JSON com disponibilidade por item.
-- NÃO modifica estado.
CREATE OR REPLACE FUNCTION public.check_stock_availability(
  p_order_id UUID
)
RETURNS JSONB
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_clinic_id UUID;
  v_result JSONB;
  v_items JSONB;
  v_item RECORD;
  v_available_qty NUMERIC;
  v_status_text TEXT;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'check_stock_availability: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'estoquista', 'manipulador') THEN
    RAISE EXCEPTION 'check_stock_availability: permissão negada';
  END IF;

  -- 3. Verificar existência da ordem
  SELECT clinic_id INTO v_clinic_id FROM compounding_orders WHERE id = p_order_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'check_stock_availability: ordem não encontrada';
  END IF;

  -- 4. Montar JSON de disponibilidade
  v_items := '[]'::JSONB;

  FOR v_item IN
    SELECT coi.id, coi.inventory_item_id, coi.total_required_quantity, coi.unit, p.nome
    FROM compounding_order_items coi
    LEFT JOIN produtos p ON p.id = coi.inventory_item_id
    WHERE coi.order_id = p_order_id
    ORDER BY coi.sequence
  LOOP
    -- Soma quantidade disponível em lotes APPROVED
    SELECT COALESCE(SUM(quantidade - quantidade_reservada), 0)
      INTO v_available_qty
      FROM lotes
      WHERE produto_id = v_item.inventory_item_id
        AND status = 'APPROVED'
        AND (data_validade IS NULL OR data_validade >= CURRENT_DATE);

    IF v_available_qty >= v_item.total_required_quantity THEN
      v_status_text := 'AVAILABLE';
    ELSIF v_available_qty > 0 THEN
      v_status_text := 'PARTIAL';
    ELSE
      v_status_text := 'UNAVAILABLE';
    END IF;

    v_items := v_items || jsonb_build_object(
      'order_item_id', v_item.id,
      'inventory_item_id', v_item.inventory_item_id,
      'product_name', v_item.nome,
      'required_qty', v_item.total_required_quantity,
      'unit', v_item.unit,
      'available_qty', v_available_qty,
      'status', v_status_text
    );
  END LOOP;

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'items', v_items,
    'all_available', NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_items) AS elem
      WHERE elem->>'status' != 'AVAILABLE'
    ),
    'checked_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 6. FUNÇÃO: reserve_inventory_for_order
-- ============================================================
-- CRITICAL: Para cada item, encontra melhor lote por FEFO
-- (expiry ASC, received ASC), faz SELECT FOR UPDATE,
-- cria inventory_lot_reservations. Status -> STOCK_RESERVED
-- ou MISSING_STOCK.
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
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_item RECORD;
  v_needed_qty NUMERIC;
  v_lot RECORD;
  v_reserve_qty NUMERIC;
  v_all_available BOOLEAN := TRUE;
  v_missing_items TEXT[] := '{}';
  v_reservation_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: permissão negada';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: ordem não encontrada';
  END IF;

  -- 4. Idempotency: se já reservado ou além, retorna
  IF v_current_status IN ('STOCK_RESERVED', 'QUEUED_FOR_PRODUCTION', 'IN_SEPARATION',
                          'AWAITING_WEIGHING', 'IN_WEIGHING', 'IN_COMPOUNDING',
                          'IN_PROCESS_CONTROL', 'AWAITING_PACKAGING', 'IN_PACKAGING',
                          'AWAITING_LABELING', 'IN_LABELING', 'PRODUCTION_COMPLETED',
                          'AWAITING_FINAL_QUALITY_CONTROL', 'QUARANTINED',
                          'AWAITING_PHARMACIST_RELEASE', 'RELEASED_BY_PHARMACIST',
                          'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite reservar a partir de APPROVED_FOR_PRODUCTION, CHECKING_STOCK ou MISSING_STOCK
  IF v_current_status NOT IN ('APPROVED_FOR_PRODUCTION', 'CHECKING_STOCK', 'MISSING_STOCK') THEN
    RAISE EXCEPTION 'reserve_inventory_for_order: status inválido (%) para reserva', v_current_status;
  END IF;

  -- 6. Transação
  BEGIN
    -- 6a. Processar cada item da ordem
    FOR v_item IN
      SELECT coi.id AS item_id, coi.inventory_item_id, coi.total_required_quantity, coi.unit
      FROM compounding_order_items coi
      WHERE coi.order_id = p_order_id
      ORDER BY coi.sequence
    LOOP
      v_needed_qty := v_item.total_required_quantity;

      -- 6b. Buscar lotes por FEFO com FOR UPDATE
      FOR v_lot IN
        SELECT id, quantidade, quantidade_reservada,
               (quantidade - quantidade_reservada) AS available
        FROM lotes
        WHERE produto_id = v_item.inventory_item_id
          AND status = 'APPROVED'
          AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
          AND (quantidade - quantidade_reservada) > 0
        ORDER BY data_validade ASC NULLS LAST,
                 data_recebimento ASC NULLS LAST,
                 id ASC
        FOR UPDATE OF lotes
      LOOP
        IF v_needed_qty <= 0 THEN
          EXIT;
        END IF;

        v_reserve_qty := LEAST(v_lot.available, v_needed_qty);

        -- Criar reserva
        INSERT INTO inventory_lot_reservations (
          clinic_id, order_id, order_item_id,
          inventory_item_id, inventory_lot_id,
          reserved_quantity, consumed_quantity, unit,
          status, reserved_by, expires_at
        ) VALUES (
          v_clinic_id, p_order_id, v_item.item_id,
          v_item.inventory_item_id, v_lot.id,
          v_reserve_qty, 0, v_item.unit,
          'ACTIVE', v_user_id,
          NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO v_reservation_id;

        -- Decrementar quantidade disponível no lote
        UPDATE lotes
          SET quantidade_reservada = quantidade_reservada + v_reserve_qty
          WHERE id = v_lot.id;

        v_needed_qty := v_needed_qty - v_reserve_qty;
      END LOOP;

      -- 6c. Se ainda resta necessidade, marcar como faltante
      IF v_needed_qty > 0 THEN
        v_all_available := FALSE;
        v_missing_items := array_append(v_missing_items, v_item.item_id::TEXT);
      END IF;
    END LOOP;

    -- 6d. Atualizar status da ordem
    IF v_all_available THEN
      UPDATE compounding_orders SET status = 'STOCK_RESERVED' WHERE id = p_order_id;
      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'STOCK_RESERVED', v_user_id,
              'Estoque reservado com sucesso');
    ELSE
      UPDATE compounding_orders SET status = 'MISSING_STOCK' WHERE id = p_order_id;
      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'MISSING_STOCK', v_user_id,
              'Itens faltantes: ' || array_to_string(v_missing_items, ', '));
    END IF;

    -- 6e. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := CASE WHEN v_all_available THEN 'STOCK_RESERVED' ELSE 'STOCK_MISSING' END,
      p_entity_type := 'inventory_lot_reservations',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'all_available', v_all_available,
        'missing_items', v_missing_items
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 7. FUNÇÃO: release_expired_reservation
-- ============================================================
-- Libera uma reserva expirada: status -> EXPIRED,
-- devolve quantidade ao lote.
CREATE OR REPLACE FUNCTION public.release_expired_reservation(
  p_reservation_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_res RECORD;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'release_expired_reservation: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'estoquista') THEN
    RAISE EXCEPTION 'release_expired_reservation: permissão negada';
  END IF;

  -- 3. Carregar reserva
  SELECT * INTO v_res FROM inventory_lot_reservations WHERE id = p_reservation_id;
  IF v_res.id IS NULL THEN
    RAISE EXCEPTION 'release_expired_reservation: reserva não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_res.status = 'EXPIRED' THEN
    RETURN p_reservation_id;
  END IF;

  -- 5. Só libera se ACTIVE
  IF v_res.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'release_expired_reservation: reserva não está ativa (status %)', v_res.status;
  END IF;

  -- 6. Transação
  BEGIN
    -- 6a. Devolver quantidade ao lote (FOR UPDATE no lote)
    PERFORM id FROM lotes WHERE id = v_res.inventory_lot_id FOR UPDATE;
    UPDATE lotes
      SET quantidade_reservada = GREATEST(quantidade_reservada - v_res.reserved_quantity, 0)
      WHERE id = v_res.inventory_lot_id;

    -- 6b. Atualizar reserva
    UPDATE inventory_lot_reservations
      SET status = 'EXPIRED',
          released_at = NOW(),
          release_reason = 'Expirada automaticamente'
      WHERE id = p_reservation_id;

    -- 6c. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_res.clinic_id,
      p_order_id := v_res.order_id,
      p_event_type := 'RESERVATION_EXPIRED',
      p_entity_type := 'inventory_lot_reservations',
      p_entity_id := p_reservation_id,
      p_new_data := jsonb_build_object(
        'reserved_quantity', v_res.reserved_quantity,
        'released_at', NOW()
      )
    );

    RETURN p_reservation_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 8. FUNÇÃO: start_separation
-- ============================================================
-- Atribui manipulador. Status -> IN_SEPARATION.
CREATE OR REPLACE FUNCTION public.start_separation(
  p_order_id UUID,
  p_manipulator_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_manip_role TEXT;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'start_separation: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'start_separation: permissão negada';
  END IF;

  -- 3. Validar que o manipulador existe e tem role adequada
  SELECT role INTO v_manip_role FROM profiles WHERE id = p_manipulator_id;
  IF v_manip_role IS NULL OR v_manip_role NOT IN ('manipulador', 'farmaceutico', 'administrador') THEN
    RAISE EXCEPTION 'start_separation: o usuário informado não é um manipulador válido';
  END IF;

  -- 4. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'start_separation: ordem não encontrada';
  END IF;

  -- 5. Idempotency: se já IN_SEPARATION, atualiza apenas se mudou manipulador
  IF v_current_status = 'IN_SEPARATION' THEN
    RETURN p_order_id;
  END IF;

  -- 6. Só permite a partir de STOCK_RESERVED ou QUEUED_FOR_PRODUCTION
  IF v_current_status NOT IN ('STOCK_RESERVED', 'QUEUED_FOR_PRODUCTION') THEN
    RAISE EXCEPTION 'start_separation: status inválido (%) para iniciar separação', v_current_status;
  END IF;

  -- 7. Transação
  BEGIN
    UPDATE compounding_orders
      SET status = 'IN_SEPARATION',
          assigned_manipulator_id = p_manipulator_id,
          scheduled_start_at = COALESCE(scheduled_start_at, NOW())
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'IN_SEPARATION', v_user_id,
            'Separação iniciada - Manipulador: ' || p_manipulator_id::TEXT);

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'SEPARATION_STARTED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object('manipulator_id', p_manipulator_id)
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 9. FUNÇÃO: confirm_separation
-- ============================================================
-- Confere separação (checked_by, checked_at, status -> CHECKED).
CREATE OR REPLACE FUNCTION public.confirm_separation(
  p_separation_id UUID,
  p_checked_by UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_sep RECORD;
  v_clinic_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'confirm_separation: usuário não autenticado';
  END IF;

  -- 2. Role: conferente deve ser farmacêutico ou admin
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'confirm_separation: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Validar checked_by
  SELECT role INTO v_user_role FROM profiles WHERE id = p_checked_by;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'confirm_separation: checked_by não é um usuário válido';
  END IF;

  -- 4. Carregar separação
  SELECT cs.*, co.clinic_id
    INTO v_sep
    FROM compounding_separations cs
    JOIN compounding_orders co ON co.id = cs.order_id
    WHERE cs.id = p_separation_id;
  IF v_sep.id IS NULL THEN
    RAISE EXCEPTION 'confirm_separation: separação não encontrada';
  END IF;

  v_clinic_id := v_sep.clinic_id;

  -- 5. Idempotency
  IF v_sep.status = 'CHECKED' THEN
    RETURN p_separation_id;
  END IF;

  -- 6. Só confere se PENDING ou SEPARATED
  IF v_sep.status NOT IN ('PENDING', 'SEPARATED') THEN
    RAISE EXCEPTION 'confirm_separation: separação já foi conferida (status %)', v_sep.status;
  END IF;

  -- 7. Transação
  BEGIN
    UPDATE compounding_separations
      SET status = 'CHECKED',
          checked_by = p_checked_by,
          checked_at = NOW()
      WHERE id = p_separation_id;

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := v_sep.order_id,
      p_event_type := 'SEPARATION_CHECKED',
      p_entity_type := 'compounding_separations',
      p_entity_id := p_separation_id,
      p_new_data := jsonb_build_object('checked_by', p_checked_by)
    );

    RETURN p_separation_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 10. FUNÇÃO: register_weighing
-- ============================================================
-- Cria registro de pesagem. Valida tolerância.
-- Se dentro: status RECORDED. Se fora: status REJECTED.
CREATE OR REPLACE FUNCTION public.register_weighing(
  p_order_item_id UUID,
  p_reservation_id UUID,
  p_sequence INTEGER,
  p_theoretical_qty NUMERIC,
  p_actual_qty NUMERIC,
  p_unit TEXT,
  p_allowed_min NUMERIC DEFAULT NULL,
  p_allowed_max NUMERIC DEFAULT NULL,
  p_container_tare NUMERIC DEFAULT NULL,
  p_gross_weight NUMERIC DEFAULT NULL,
  p_equipment_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_order_id UUID;
  v_clinic_id UUID;
  v_weighing_id UUID;
  v_net_weight NUMERIC;
  v_status weighing_status;
  v_item RECORD;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'register_weighing: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'register_weighing: permissão negada';
  END IF;

  -- 3. Carregar item e order
  SELECT coi.*, co.clinic_id, co.id AS ord_id
    INTO v_item
    FROM compounding_order_items coi
    JOIN compounding_orders co ON co.id = coi.order_id
    WHERE coi.id = p_order_item_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'register_weighing: item da ordem não encontrado';
  END IF;
  v_order_id := v_item.ord_id;
  v_clinic_id := v_item.clinic_id;

  -- 4. Calcular net weight
  IF p_gross_weight IS NOT NULL AND p_container_tare IS NOT NULL THEN
    v_net_weight := p_gross_weight - p_container_tare;
  ELSE
    v_net_weight := p_actual_qty;
  END IF;

  -- 5. Validar tolerância
  IF p_allowed_min IS NOT NULL AND p_allowed_max IS NOT NULL THEN
    IF v_net_weight >= p_allowed_min AND v_net_weight <= p_allowed_max THEN
      v_status := 'RECORDED';
    ELSE
      v_status := 'REJECTED';
    END IF;
  ELSE
    v_status := 'RECORDED';
  END IF;

  -- 6. Transação
  BEGIN
    INSERT INTO compounding_weighings (
      order_id, order_item_id, reservation_id,
      sequence, theoretical_quantity, actual_quantity, unit,
      allowed_minimum, allowed_maximum,
      container_tare, gross_weight, net_weight,
      equipment_id, weighed_by, status, notes
    ) VALUES (
      v_order_id, p_order_item_id, p_reservation_id,
      p_sequence, p_theoretical_qty, p_actual_qty, p_unit,
      p_allowed_min, p_allowed_max,
      p_container_tare, p_gross_weight, v_net_weight,
      p_equipment_id, v_user_id, v_status, p_notes
    )
    RETURNING id INTO v_weighing_id;

    -- Se rejeitada, criar deviation
    IF v_status = 'REJECTED' THEN
      INSERT INTO compounding_deviations (
        order_id, deviation_type, severity, description,
        detected_by, detected_at, status
      ) VALUES (
        v_order_id, 'WEIGHING_OUT_OF_TOLERANCE', 'MEDIUM',
        'Pesagem fora da tolerância: teórico=' || p_theoretical_qty ||
        ', real=' || v_net_weight || ', minimo=' || COALESCE(p_allowed_min::TEXT, 'N/A') ||
        ', maximo=' || COALESCE(p_allowed_max::TEXT, 'N/A'),
        v_user_id, NOW(), 'OPEN'
      );
    END IF;

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := v_order_id,
      p_event_type := CASE WHEN v_status = 'RECORDED' THEN 'WEIGHING_RECORDED' ELSE 'WEIGHING_REJECTED' END,
      p_entity_type := 'compounding_weighings',
      p_entity_id := v_weighing_id,
      p_new_data := jsonb_build_object(
        'order_item_id', p_order_item_id,
        'theoretical', p_theoretical_qty,
        'actual', p_actual_qty,
        'status', v_status
      )
    );

    RETURN v_weighing_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 11. FUNÇÃO: complete_weighing
-- ============================================================
-- Verifica se todos os itens foram pesados dentro da tolerância.
-- Transiciona AWAITING_WEIGHING/IN_WEIGHING -> IN_COMPOUNDING.
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
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_total_items INTEGER;
  v_weighed_items INTEGER;
  v_rejected_items INTEGER;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_weighing: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'complete_weighing: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'complete_weighing: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('IN_COMPOUNDING', 'IN_PROCESS_CONTROL',
                          'AWAITING_PACKAGING', 'IN_PACKAGING',
                          'AWAITING_LABELING', 'IN_LABELING',
                          'PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL',
                          'QUARANTINED', 'AWAITING_PHARMACIST_RELEASE',
                          'RELEASED_BY_PHARMACIST', 'READY_FOR_PICKUP',
                          'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite se estiver em AWAITING_WEIGHING ou IN_WEIGHING
  IF v_current_status NOT IN ('AWAITING_WEIGHING', 'IN_WEIGHING') THEN
    RAISE EXCEPTION 'complete_weighing: status inválido (%) para finalizar pesagem', v_current_status;
  END IF;

  -- 6. Verificar pesagens
  -- Total de itens únicos na ordem
  SELECT COUNT(*) INTO v_total_items
  FROM compounding_order_items WHERE order_id = p_order_id;

  -- Itens com ao menos uma pesagem RECORDED
  SELECT COUNT(DISTINCT order_item_id) INTO v_weighed_items
  FROM compounding_weighings
  WHERE order_id = p_order_id AND status = 'RECORDED';

  -- Itens com pesagem REJECTED
  SELECT COUNT(DISTINCT order_item_id) INTO v_rejected_items
  FROM compounding_weighings
  WHERE order_id = p_order_id AND status = 'REJECTED';

  -- Validar
  IF v_weighed_items < v_total_items THEN
    RAISE EXCEPTION 'complete_weighing: % de % itens foram pesados dentro da tolerância', v_weighed_items, v_total_items;
  END IF;

  IF v_rejected_items > 0 THEN
    RAISE EXCEPTION 'complete_weighing: % itens possuem pesagens rejeitadas. Resolva as deviatiões antes de prosseguir', v_rejected_items;
  END IF;

  -- 7. Transação
  BEGIN
    UPDATE compounding_orders
      SET status = 'IN_COMPOUNDING'
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'IN_COMPOUNDING', v_user_id,
            'Pesagem concluída - todos os itens dentro da tolerância');

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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 12. FUNÇÃO: start_compounding_step
-- ============================================================
-- Marca etapa como IN_PROGRESS.
CREATE OR REPLACE FUNCTION public.start_compounding_step(
  p_step_id UUID,
  p_user_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_role TEXT;
  v_step RECORD;
  v_clinic_id UUID;
  v_step_user_role TEXT;
BEGIN
  -- 1. Autenticação
  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'start_compounding_step: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_auth_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'start_compounding_step: permissão negada';
  END IF;

  -- 3. Validar p_user_id
  SELECT role INTO v_step_user_role FROM profiles WHERE id = p_user_id;
  IF v_step_user_role IS NULL OR v_step_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'start_compounding_step: o usuário informado não é válido';
  END IF;

  -- 4. Carregar step e clinic
  SELECT cs.*, co.clinic_id
    INTO v_step
    FROM compounding_steps cs
    JOIN compounding_orders co ON co.id = cs.order_id
    WHERE cs.id = p_step_id;
  IF v_step.id IS NULL THEN
    RAISE EXCEPTION 'start_compounding_step: etapa não encontrada';
  END IF;
  v_clinic_id := v_step.clinic_id;

  -- 5. Idempotency
  IF v_step.status = 'IN_PROGRESS' THEN
    RETURN p_step_id;
  END IF;

  -- 6. Só inicia se PENDING
  IF v_step.status != 'PENDING' THEN
    RAISE EXCEPTION 'start_compounding_step: etapa já foi iniciada (status %)', v_step.status;
  END IF;

  -- 7. Transação
  BEGIN
    UPDATE compounding_steps
      SET status = 'IN_PROGRESS',
          started_by = p_user_id,
          started_at = NOW()
      WHERE id = p_step_id;

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := v_step.order_id,
      p_event_type := 'STEP_STARTED',
      p_entity_type := 'compounding_steps',
      p_entity_id := p_step_id,
      p_new_data := jsonb_build_object('started_by', p_user_id)
    );

    RETURN p_step_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 13. FUNÇÃO: complete_compounding_step
-- ============================================================
-- Marca etapa como COMPLETED.
CREATE OR REPLACE FUNCTION public.complete_compounding_step(
  p_step_id UUID,
  p_measured_values JSONB DEFAULT NULL,
  p_equipment_data JSONB DEFAULT NULL,
  p_environment_data JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_step RECORD;
  v_clinic_id UUID;
  v_deviation_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_compounding_step: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'manipulador') THEN
    RAISE EXCEPTION 'complete_compounding_step: permissão negada';
  END IF;

  -- 3. Carregar step
  SELECT cs.*, co.clinic_id
    INTO v_step
    FROM compounding_steps cs
    JOIN compounding_orders co ON co.id = cs.order_id
    WHERE cs.id = p_step_id;
  IF v_step.id IS NULL THEN
    RAISE EXCEPTION 'complete_compounding_step: etapa não encontrada';
  END IF;
  v_clinic_id := v_step.clinic_id;

  -- 4. Idempotency
  IF v_step.status = 'COMPLETED' THEN
    RETURN p_step_id;
  END IF;

  -- 5. Só completa se IN_PROGRESS
  IF v_step.status != 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'complete_compounding_step: etapa não está em andamento (status %)', v_step.status;
  END IF;

  -- 6. Transação
  BEGIN
    UPDATE compounding_steps
      SET status = 'COMPLETED',
          completed_by = v_user_id,
          completed_at = NOW(),
          measured_values = COALESCE(p_measured_values, measured_values),
          equipment_data = COALESCE(p_equipment_data, equipment_data),
          environment_data = COALESCE(p_environment_data, environment_data),
          notes = COALESCE(p_notes, notes)
      WHERE id = p_step_id;

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := v_step.order_id,
      p_event_type := 'STEP_COMPLETED',
      p_entity_type := 'compounding_steps',
      p_entity_id := p_step_id,
      p_new_data := jsonb_build_object(
        'completed_by', v_user_id,
        'has_measured_values', p_measured_values IS NOT NULL
      )
    );

    RETURN p_step_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 14. FUNÇÃO: complete_production
-- ============================================================
-- CRITICAL: Verifica se todas as etapas foram concluídas,
-- todas as pesagens registradas, sem deviatiões crIticas.
-- Calcula consumo final, registra movimentações de estoque.
-- Status -> PRODUCTION_COMPLETED.
CREATE OR REPLACE FUNCTION public.complete_production(
  p_order_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_total_steps INTEGER;
  v_completed_steps INTEGER;
  v_pending_steps INTEGER;
  v_open_critical INTEGER;
  v_weighing RECORD;
  v_lot_reservation RECORD;
  v_total_consumed NUMERIC;
  v_batch_number TEXT;
  v_movement_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_production: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'complete_production: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'complete_production: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL',
                          'QUARANTINED', 'AWAITING_PHARMACIST_RELEASE',
                          'RELEASED_BY_PHARMACIST', 'READY_FOR_PICKUP',
                          'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Validações de pré-requisitos
  -- 5a. Pelo menos 1 etapa concluída
  SELECT COUNT(*) INTO v_total_steps FROM compounding_steps WHERE order_id = p_order_id;
  SELECT COUNT(*) INTO v_completed_steps FROM compounding_steps WHERE order_id = p_order_id AND status = 'COMPLETED';
  SELECT COUNT(*) INTO v_pending_steps FROM compounding_steps WHERE order_id = p_order_id AND status IN ('PENDING', 'IN_PROGRESS');

  IF v_completed_steps = 0 THEN
    RAISE EXCEPTION 'complete_production: nenhuma etapa de produção foi concluída';
  END IF;

  IF v_pending_steps > 0 THEN
    RAISE EXCEPTION 'complete_production: % etapa(s) ainda pendentes ou em andamento', v_pending_steps;
  END IF;

  -- 5b. Todas as pesagens registradas
  IF EXISTS (
    SELECT 1 FROM compounding_order_items coi
    WHERE coi.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM compounding_weighings cw
        WHERE cw.order_item_id = coi.id AND cw.status IN ('RECORDED', 'VERIFIED')
      )
  ) THEN
    RAISE EXCEPTION 'complete_production: existem itens sem pesagem registrada';
  END IF;

  -- 5c. Sem deviatiões crIticas em aberto
  SELECT COUNT(*) INTO v_open_critical
  FROM compounding_deviations
  WHERE order_id = p_order_id
    AND status IN ('OPEN', 'INVESTIGATION')
    AND severity = 'CRITICAL';

  IF v_open_critical > 0 THEN
    RAISE EXCEPTION 'complete_production: existem % deviatiões crIticas em aberto', v_open_critical;
  END IF;

  -- 6. Gerar batch number
  v_batch_number := 'BAT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(MAX(SPLIT_PART(COALESCE(final_batch_number, 'BAT-00000000-0000'), '-', 3)::INTEGER), 0) + 1
     FROM compounding_orders WHERE final_batch_number LIKE 'BAT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%')::TEXT, 4, '0'
  );

  -- 7. Transação
  BEGIN
    -- 7a. Para cada reserva ativa, calcular consumo real e registrar movimentação
    FOR v_lot_reservation IN
      SELECT ilr.*
      FROM inventory_lot_reservations ilr
      WHERE ilr.order_id = p_order_id AND ilr.status IN ('ACTIVE', 'PARTIALLY_CONSUMED')
    LOOP
      -- Calcular consumo total das pesagens deste item+lote
      SELECT COALESCE(SUM(cw.actual_quantity), 0)
        INTO v_total_consumed
        FROM compounding_weighings cw
        WHERE cw.reservation_id = v_lot_reservation.id
          AND cw.status IN ('RECORDED', 'VERIFIED');

      -- Se não há pesagem direta, usar o reservado como consumo
      IF v_total_consumed = 0 THEN
        v_total_consumed := v_lot_reservation.reserved_quantity;
      END IF;

      -- Atualizar reservation
      UPDATE inventory_lot_reservations
        SET consumed_quantity = v_total_consumed,
            status = CASE
              WHEN v_total_consumed >= v_lot_reservation.reserved_quantity THEN 'CONSUMED'
              WHEN v_total_consumed > 0 THEN 'PARTIALLY_CONSUMED'
              ELSE 'RELEASED'
            END
        WHERE id = v_lot_reservation.id;

      -- Atualizar actual_consumed_quantity no order item
      UPDATE compounding_order_items
        SET actual_consumed_quantity = actual_consumed_quantity + v_total_consumed
        WHERE id = v_lot_reservation.order_item_id;

      -- Registrar movimentação de estoque (PRODUCTION_CONSUMPTION)
      INSERT INTO inventory_movements (
        clinic_id, produto_id, lote_id, movement_type,
        quantity, unit, reference_type, reference_id,
        reason, created_by
      ) VALUES (
        v_clinic_id,
        v_lot_reservation.inventory_item_id,
        v_lot_reservation.inventory_lot_id,
        'PRODUCTION_CONSUMPTION',
        v_total_consumed,
        v_lot_reservation.unit,
        'compounding_orders',
        p_order_id,
        'Consumo de produção - Ordem de manipulação',
        v_user_id
      )
      RETURNING id INTO v_movement_id;

      -- Decrementar estoque físico do lote
      UPDATE lotes
        SET quantidade = GREATEST(quantidade - v_total_consumed, 0),
            quantidade_reservada = GREATEST(quantidade_reservada - v_total_consumed, 0)
        WHERE id = v_lot_reservation.inventory_lot_id;
    END LOOP;

    -- 7b. Atualizar ordem
    UPDATE compounding_orders
      SET status = 'PRODUCTION_COMPLETED',
          final_batch_number = v_batch_number,
          production_completed_at = NOW()
      WHERE id = p_order_id;

    -- 7c. Status history
    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'PRODUCTION_COMPLETED', v_user_id,
            'Produção concluída - Lote: ' || v_batch_number);

    -- 7d. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'PRODUCTION_COMPLETED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'batch_number', v_batch_number,
        'completed_steps', v_completed_steps,
        'total_steps', v_total_steps
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 15. FUNÇÃO: register_quality_result
-- ============================================================
-- Registra resultados de controle de qualidade.
-- Se algum check REQUIRED for REJECTED -> decisão REJECTED
--   -> status QUARANTINED.
-- Se todos APPROVED -> AWAITING_PHARMACIST_RELEASE.
CREATE OR REPLACE FUNCTION public.register_quality_result(
  p_order_id UUID,
  p_checks_json JSONB DEFAULT '[]',
  p_decision quality_decision DEFAULT 'APPROVED',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_check JSONB;
  v_has_rejected_required BOOLEAN := FALSE;
  v_actual_decision quality_decision;
  v_all_approved BOOLEAN := TRUE;
  v_check_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'register_quality_result: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'register_quality_result: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'register_quality_result: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('AWAITING_PHARMACIST_RELEASE', 'RELEASED_BY_PHARMACIST',
                          'READY_FOR_PICKUP', 'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite a partir de PRODUCTION_COMPLETED ou QUALITY_CONTROL_REJECTED ou REWORK_REQUIRED
  IF v_current_status NOT IN ('PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL',
                              'QUALITY_CONTROL_REJECTED', 'REWORK_REQUIRED') THEN
    RAISE EXCEPTION 'register_quality_result: status inválido (%) para controle de qualidade', v_current_status;
  END IF;

  -- 6. Processar checks do JSON
  FOR v_check IN SELECT * FROM jsonb_array_elements(p_checks_json)
  LOOP
    INSERT INTO compounding_quality_checks (
      order_id, check_stage, check_type, required,
      target_value, minimum_value, maximum_value, unit,
      result_value, result_status, method_reference,
      equipment_id, performed_by, performed_at, notes
    ) VALUES (
      p_order_id,
      v_check->>'check_stage',
      v_check->>'check_type',
      COALESCE((v_check->>'required')::BOOLEAN, TRUE),
      v_check->>'target_value',
      (v_check->>'minimum_value')::NUMERIC,
      (v_check->>'maximum_value')::NUMERIC,
      v_check->>'unit',
      v_check->>'result_value',
      COALESCE((v_check->>'result_status')::quality_status, 'APPROVED'),
      v_check->>'method_reference',
      (v_check->>'equipment_id')::UUID,
      v_user_id,
      NOW(),
      v_check->>'notes'
    )
    RETURNING id INTO v_check_id;

    -- Verificar se check required foi rejeitado
    IF (v_check->>'required')::BOOLEAN IS NOT FALSE
       AND COALESCE((v_check->>'result_status')::quality_status, 'APPROVED') = 'REJECTED'
    THEN
      v_has_rejected_required := TRUE;
    END IF;

    IF COALESCE((v_check->>'result_status')::quality_status, 'APPROVED') != 'APPROVED' THEN
      v_all_approved := FALSE;
    END IF;
  END LOOP;

  -- 7. Determinar decisão final
  IF v_has_rejected_required THEN
    v_actual_decision := 'REJECTED';
  ELSIF v_all_approved THEN
    v_actual_decision := 'APPROVED';
  ELSE
    v_actual_decision := p_decision;
  END IF;

  -- 8. Transação
  BEGIN
    IF v_actual_decision = 'REJECTED' THEN
      -- Quarentena
      UPDATE compounding_orders
        SET status = 'QUARANTINED'
        WHERE id = p_order_id;

      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'QUARANTINED', v_user_id,
              'CQ rejeitado - itens obrigatórios reprovados');

      -- Criar deviation automática
      INSERT INTO compounding_deviations (
        order_id, deviation_type, severity, description,
        detected_by, detected_at, status
      ) VALUES (
        p_order_id, 'QUALITY_CONTROL_REJECTED', 'HIGH',
        'Controle de Qualidade rejeitado: ' || COALESCE(p_notes, 'Requisitos obrigatórios não atendidos'),
        v_user_id, NOW(), 'OPEN'
      );

    ELSIF v_actual_decision IN ('APPROVED') THEN
      -- Avançar para aguardando liberação farmacêutica
      UPDATE compounding_orders
        SET status = 'AWAITING_PHARMACIST_RELEASE'
        WHERE id = p_order_id;

      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'AWAITING_PHARMACIST_RELEASE', v_user_id,
              'CQ aprovado - aguardando liberação farmacêutica');
    ELSE
      -- Outras decisões (QUARANTINED, REWORK_REQUIRED, INVESTIGATION_REQUIRED)
      UPDATE compounding_orders
        SET status = CASE v_actual_decision
                       WHEN 'QUARANTINED' THEN 'QUARANTINED'
                       WHEN 'REWORK_REQUIRED' THEN 'REWORK_REQUIRED'
                       WHEN 'INVESTIGATION_REQUIRED' THEN 'QUARANTINED'
                       ELSE 'QUARANTINED'
                     END
        WHERE id = p_order_id;

      INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
      VALUES (v_clinic_id, p_order_id, v_current_status::TEXT,
              CASE v_actual_decision
                WHEN 'QUARANTINED' THEN 'QUARANTINED'
                WHEN 'REWORK_REQUIRED' THEN 'REWORK_REQUIRED'
                ELSE 'QUARANTINED'
              END,
              v_user_id, 'CQ: ' || v_actual_decision::TEXT || ' - ' || COALESCE(p_notes, ''));
    END IF;

    -- Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'QUALITY_CONTROL_' || v_actual_decision::TEXT,
      p_entity_type := 'compounding_quality_checks',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'decision', v_actual_decision,
        'notes', p_notes,
        'checks_count', jsonb_array_length(p_checks_json)
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 16. FUNÇÃO: quarantine_order
-- ============================================================
-- Coloca ordem em quarentena e cria deviation.
CREATE OR REPLACE FUNCTION public.quarantine_order(
  p_order_id UUID,
  p_reason TEXT,
  p_pharmacist_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_deviation_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'quarantine_order: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'quarantine_order: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Validar pharmacist
  SELECT role INTO v_user_role FROM profiles WHERE id = p_pharmacist_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'quarantine_order: farmacêutico inválido';
  END IF;

  -- 4. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'quarantine_order: ordem não encontrada';
  END IF;

  -- 5. Idempotency
  IF v_current_status = 'QUARANTINED' THEN
    RETURN p_order_id;
  END IF;

  -- 6. Transação
  BEGIN
    UPDATE compounding_orders
      SET status = 'QUARANTINED'
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'QUARANTINED', v_user_id,
            'Quarentena: ' || p_reason);

    -- Criar deviation
    INSERT INTO compounding_deviations (
      order_id, deviation_type, severity, description,
      detected_by, detected_at, status
    ) VALUES (
      p_order_id, 'QUARANTINE', 'HIGH',
      'Ordem em quarentena: ' || p_reason,
      p_pharmacist_id, NOW(), 'OPEN'
    )
    RETURNING id INTO v_deviation_id;

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'ORDER_QUARANTINED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'reason', p_reason,
        'pharmacist_id', p_pharmacist_id,
        'deviation_id', v_deviation_id
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 17. FUNÇÃO: sign_pharmacist_release
-- ============================================================
-- CRITICAL: Valida pré-requisitos, cria registro de liberação,
-- calcula hashes, transiciona status.
CREATE OR REPLACE FUNCTION public.sign_pharmacist_release(
  p_order_id UUID,
  p_pharmacist_name TEXT,
  p_crf_number TEXT,
  p_crf_state TEXT,
  p_signature_method signature_method DEFAULT 'ADVANCED_ELECTRONIC_SIGNATURE',
  p_decision release_decision DEFAULT 'APPROVED',
  p_notes TEXT DEFAULT NULL,
  p_certificate_subject TEXT DEFAULT NULL,
  p_certificate_issuer TEXT DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_open_critical INTEGER;
  v_release_id UUID;
  v_order_hash TEXT;
  v_production_hash TEXT;
  v_quality_hash TEXT;
  v_release_hash TEXT;
  v_order_data TEXT;
  v_production_data TEXT;
  v_quality_data TEXT;
  v_release_data TEXT;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'sign_pharmacist_release: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'sign_pharmacist_release: permissão negada (necessário farmacêutico ou administrador)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'sign_pharmacist_release: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status = 'RELEASED_BY_PHARMACIST' THEN
    SELECT id INTO v_release_id FROM compounding_releases WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1;
    RETURN COALESCE(v_release_id, p_order_id);
  END IF;

  -- 5. Pré-requisitos
  IF v_current_status != 'AWAITING_PHARMACIST_RELEASE' THEN
    RAISE EXCEPTION 'sign_pharmacist_release: status inválido (%). Necessário AWAITING_PHARMACIST_RELEASE', v_current_status;
  END IF;

  -- 5a. CQ aprovado (nenhum check REQUIRED pode estar PENDING ou REJECTED)
  IF EXISTS (
    SELECT 1 FROM compounding_quality_checks
    WHERE order_id = p_order_id
      AND required = TRUE
      AND result_status NOT IN ('APPROVED', 'NOT_APPLICABLE')
  ) THEN
    RAISE EXCEPTION 'sign_pharmacist_release: existem checks de qualidade obrigatórios pendentes ou rejeitados';
  END IF;

  -- 5b. Sem deviatiões crIticas em aberto
  SELECT COUNT(*) INTO v_open_critical
  FROM compounding_deviations
  WHERE order_id = p_order_id
    AND status IN ('OPEN', 'INVESTIGATION')
    AND severity = 'CRITICAL';

  IF v_open_critical > 0 THEN
    RAISE EXCEPTION 'sign_pharmacist_release: existem % deviatiões crIticas em aberto', v_open_critical;
  END IF;

  -- 6. Calcular hashes
  -- Order hash
  SELECT encode(sha256(
    (SELECT row_to_json(c)::text FROM (
      SELECT id, internal_number, patient_id, pharmaceutical_form,
             requested_quantity, requested_unit, status, priority,
             created_at, production_completed_at
      FROM compounding_orders WHERE id = p_order_id
    ) c)::bytea
  ), 'hex') INTO v_order_hash;

  -- Production record hash (steps + weighings)
  SELECT encode(sha256(
    COALESCE((
      SELECT string_agg(row_to_json(s)::text, '|' ORDER BY s.sequence)
      FROM (SELECT sequence, step_type, status, started_at, completed_at,
                   measured_values, equipment_data, environment_data
            FROM compounding_steps WHERE order_id = p_order_id) s
    ), '')::bytea
  ), 'hex') INTO v_production_hash;

  -- Quality record hash
  SELECT encode(sha256(
    COALESCE((
      SELECT string_agg(row_to_json(q)::text, '|' ORDER BY q.check_type)
      FROM (SELECT check_stage, check_type, required, result_value, result_status,
                   performed_at, method_reference
            FROM compounding_quality_checks WHERE order_id = p_order_id) q
    ), '')::bytea
  ), 'hex') INTO v_quality_hash;

  -- 7. Transação
  BEGIN
    -- 7a. Criar release record
    v_release_data := jsonb_build_object(
      'order_id', p_order_id,
      'pharmacist_id', v_user_id,
      'pharmacist_name', p_pharmacist_name,
      'crf_number', p_crf_number,
      'crf_state', p_crf_state,
      'decision', p_decision,
      'signature_method', p_signature_method,
      'signed_at', NOW()
    )::text;

    v_release_hash := encode(sha256(v_release_data::bytea), 'hex');

    INSERT INTO compounding_releases (
      order_id, pharmacist_id, pharmacist_name,
      crf_number, crf_state, decision, notes,
      signature_method, signature_status,
      order_hash, production_record_hash, quality_record_hash, release_record_hash,
      certificate_subject, certificate_issuer,
      signed_at
    ) VALUES (
      p_order_id, v_user_id, p_pharmacist_name,
      p_crf_number, p_crf_state, p_decision, p_notes,
      p_signature_method, 'COMPLETED',
      v_order_hash, v_production_hash, v_quality_hash, v_release_hash,
      p_certificate_subject, p_certificate_issuer,
      NOW()
    )
    RETURNING id INTO v_release_id;

    -- 7b. Atualizar status da ordem
    IF p_decision = 'APPROVED' THEN
      UPDATE compounding_orders
        SET status = 'RELEASED_BY_PHARMACIST',
            released_at = NOW()
        WHERE id = p_order_id;
    ELSE
      UPDATE compounding_orders
        SET status = 'RELEASE_REJECTED'
        WHERE id = p_order_id;

      -- Criar deviation para rejeição
      INSERT INTO compounding_deviations (
        order_id, deviation_type, severity, description,
        detected_by, detected_at, status
      ) VALUES (
        p_order_id, 'RELEASE_REJECTED', 'HIGH',
        'Liberação farmacêutica rejeitada: ' || COALESCE(p_notes, 'Sem justificativa'),
        v_user_id, NOW(), 'OPEN'
      );
    END IF;

    -- 7c. Status history
    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT,
            CASE WHEN p_decision = 'APPROVED' THEN 'RELEASED_BY_PHARMACIST' ELSE 'RELEASE_REJECTED' END,
            v_user_id,
            CASE WHEN p_decision = 'APPROVED' THEN 'Liberação farmacêutica concedida' ELSE 'Liberação farmacêutica rejeitada' END);

    -- 7d. Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := CASE WHEN p_decision = 'APPROVED' THEN 'PHARMACIST_RELEASE_SIGNED' ELSE 'PHARMACIST_RELEASE_REJECTED' END,
      p_entity_type := 'compounding_releases',
      p_entity_id := v_release_id,
      p_new_data := jsonb_build_object(
        'decision', p_decision,
        'pharmacist_name', p_pharmacist_name,
        'crf_number', p_crf_number,
        'signature_method', p_signature_method,
        'order_hash', v_order_hash,
        'release_hash', v_release_hash
      )
    );

    RETURN v_release_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 18. FUNÇÃO: mark_ready_for_pickup
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_ready_for_pickup(
  p_order_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_ready_for_pickup: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'atendente') THEN
    RAISE EXCEPTION 'mark_ready_for_pickup: permissão negada';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'mark_ready_for_pickup: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite a partir de RELEASED_BY_PHARMACIST
  IF v_current_status != 'RELEASED_BY_PHARMACIST' THEN
    RAISE EXCEPTION 'mark_ready_for_pickup: status inválido (%)', v_current_status;
  END IF;

  -- 6. Transação
  BEGIN
    UPDATE compounding_orders
      SET status = 'READY_FOR_PICKUP',
          ready_at = NOW()
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'READY_FOR_PICKUP', v_user_id,
            'Ordem disponível para retirada');

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'ORDER_READY_FOR_PICKUP',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 19. FUNÇÃO: mark_as_dispensed
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_as_dispensed(
  p_order_id UUID
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_as_dispensed: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico', 'atendente') THEN
    RAISE EXCEPTION 'mark_as_dispensed: permissão negada';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'mark_as_dispensed: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status = 'DISPENSED' THEN
    RETURN p_order_id;
  END IF;

  -- 5. Só permite de READY_FOR_PICKUP ou OUT_FOR_DELIVERY
  IF v_current_status NOT IN ('READY_FOR_PICKUP', 'OUT_FOR_DELIVERY') THEN
    RAISE EXCEPTION 'mark_as_dispensed: status inválido (%)', v_current_status;
  END IF;

  -- 6. Transação
  BEGIN
    UPDATE compounding_orders
      SET status = 'DISPENSED',
          dispensed_at = NOW()
      WHERE id = p_order_id;

    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'DISPENSED', v_user_id,
            'Medicamento entregue ao paciente');

    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'ORDER_DISPENSED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 20. FUNÇÃO: cancel_compounding_order
-- ============================================================
-- Se antes da pesagem: libera reservas ativas (status CANCELLED).
-- Se depois da pesagem: status CANCELLED, mantém reservas para
--   avaliação farmacêutica.
CREATE OR REPLACE FUNCTION public.cancel_compounding_order(
  p_order_id UUID,
  p_reason TEXT,
  p_after_weighing BOOLEAN DEFAULT FALSE
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_current_status compounding_order_status;
  v_clinic_id UUID;
  v_reservation RECORD;
BEGIN
  -- 1. Autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'cancel_compounding_order: usuário não autenticado';
  END IF;

  -- 2. Role
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'cancel_compounding_order: permissão negada (necessário administrador ou farmacêutico)';
  END IF;

  -- 3. Carregar ordem
  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'cancel_compounding_order: ordem não encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('CANCELLED', 'DESTROYED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Cancelamento só permitido para ordens que não foram dispensadas
  IF v_current_status IN ('DISPENSED', 'RELEASED_BY_PHARMACIST') AND NOT p_after_weighing THEN
    RAISE EXCEPTION 'cancel_compounding_order: ordem já foi dispensada/liberada. Use p_after_weighing=true para cancelamento pós-produção';
  END IF;

  -- 6. Transação
  BEGIN
    IF NOT p_after_weighing THEN
      -- Antes da pesagem: liberar reservas ativas
      FOR v_reservation IN
        SELECT * FROM inventory_lot_reservations
        WHERE order_id = p_order_id AND status = 'ACTIVE'
        FOR UPDATE
      LOOP
        -- Devolver ao lote
        PERFORM id FROM lotes WHERE id = v_reservation.inventory_lot_id FOR UPDATE;
        UPDATE lotes
          SET quantidade_reservada = GREATEST(quantidade_reservada - v_reservation.reserved_quantity, 0)
          WHERE id = v_reservation.inventory_lot_id;

        UPDATE inventory_lot_reservations
          SET status = 'CANCELLED',
              released_at = NOW(),
              release_reason = 'Cancelamento da ordem: ' || p_reason
          WHERE id = v_reservation.id;
      END LOOP;
    ELSE
      -- Depois da pesagem: manter reservas para avaliação farmacêutica
      -- Apenas marca como CANCELLED, sem devolver ao estoque
      NULL;
    END IF;

    -- Atualizar ordem
    UPDATE compounding_orders
      SET status = 'CANCELLED',
          cancellation_reason = p_reason
      WHERE id = p_order_id;

    -- Status history
    INSERT INTO compounding_status_history (clinic_id, order_id, previous_status, new_status, changed_by, reason)
    VALUES (v_clinic_id, p_order_id, v_current_status::TEXT, 'CANCELLED', v_user_id,
            'Cancelamento: ' || p_reason || ' (fase: ' || CASE WHEN p_after_weighing THEN 'pós-pesagem' ELSE 'pré-pesagem' END || ')');

    -- Audit log
    PERFORM log_compounding_audit(
      p_clinic_id := v_clinic_id,
      p_order_id := p_order_id,
      p_event_type := 'ORDER_CANCELLED',
      p_entity_type := 'compounding_orders',
      p_entity_id := p_order_id,
      p_new_data := jsonb_build_object(
        'reason', p_reason,
        'after_weighing', p_after_weighing,
        'previous_status', v_current_status
      )
    );

    RETURN p_order_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$;

-- ============================================================
-- 21. PERMISSÕES
-- ============================================================

-- 21a. Grant para authenticated (todos os usuários logados)
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

-- 21b. Revoke para anon e public
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;

-- ============================================================
-- FIM - Migration 006_compounding_rpc.sql
-- ============================================================
