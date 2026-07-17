-- ============================================================
-- CLJ Clínica — Fix: Stock bugs na Manipulação
-- Migration 016_fix_stock_bugs.sql
-- ============================================================
-- Problemas corrigidos:
-- 1. complete_production referencia `lotes.quantidade` (NÃO EXISTE)
--    → Troca para usar `quantidade_disponivel` mas SÓ decrementa
--      quantidade_reservada (quantidade_disponivel já foi deduzida
--      na reserva pelo reserve_inventory_for_order)
-- 2. Adiciona CHECK constraint em lotes.quantidade_disponivel >= 0
-- 3. Fix consumir_fefo para aceitar os parametros usados no front-end
-- ============================================================

-- ============================================================
-- 1. FIX: complete_production
-- ============================================================
-- A RPC reserve_inventory_for_order (produção) já decrementa
-- quantidade_disponivel E incrementa quantidade_reservada.
-- Portanto complete_production só precisa:
--   - decrementar quantidade_reservada (marcando como consumido)
--   - NÃO tocar em quantidade_disponivel (já foi debitado)
-- Além disso, a função antiga usava `lotes.quantidade` que NÃO EXISTE.
-- ============================================================
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
  v_lot_reservation RECORD;
  v_total_consumed NUMERIC;
  v_batch_number TEXT;
  v_movement_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'complete_production: usuario nao autenticado';
  END IF;

  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('administrador', 'farmaceutico') THEN
    RAISE EXCEPTION 'complete_production: permissao negada (necessario farmaceutico ou administrador)';
  END IF;

  SELECT status, clinic_id INTO v_current_status, v_clinic_id
  FROM compounding_orders WHERE id = p_order_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'complete_production: ordem nao encontrada';
  END IF;

  -- 4. Idempotency
  IF v_current_status IN ('PRODUCTION_COMPLETED', 'AWAITING_FINAL_QUALITY_CONTROL',
                          'QUARANTINED', 'AWAITING_PHARMACIST_RELEASE',
                          'RELEASED_BY_PHARMACIST', 'READY_FOR_PICKUP',
                          'DISPENSED') THEN
    RETURN p_order_id;
  END IF;

  -- 5. Validar requisitos
  -- 5a. Pelo menos 1 etapa concluida
  SELECT COUNT(*) INTO v_total_steps FROM compounding_steps WHERE order_id = p_order_id;
  SELECT COUNT(*) INTO v_completed_steps FROM compounding_steps WHERE order_id = p_order_id AND status = 'COMPLETED';
  SELECT COUNT(*) INTO v_pending_steps FROM compounding_steps WHERE order_id = p_order_id AND status IN ('PENDING', 'IN_PROGRESS');

  IF v_completed_steps = 0 THEN
    RAISE EXCEPTION 'complete_production: nenhuma etapa de producao foi concluida';
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

  -- 5c. Sem desvios criticos em aberto
  SELECT COUNT(*) INTO v_open_critical
  FROM compounding_deviations
  WHERE order_id = p_order_id
    AND status IN ('OPEN', 'INVESTIGATION')
    AND severity = 'CRITICAL';
  IF v_open_critical > 0 THEN
    RAISE EXCEPTION 'complete_production: existem % desvios criticos em aberto', v_open_critical;
  END IF;

  -- 6. Gerar batch number
  v_batch_number := 'BAT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(MAX(SPLIT_PART(COALESCE(final_batch_number, 'BAT-00000000-0000'), '-', 3)::INTEGER), 0) + 1
     FROM compounding_orders WHERE final_batch_number LIKE 'BAT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%')::TEXT, 4, '0'
  );

  -- 7. Transacao
  BEGIN
    -- 7a. Para cada reserva ativa, consumir
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

      -- Se nao ha pesagem, usar reservado
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

      -- Registrar movimentacao
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
        'Consumo de producao - Ordem de manipulacao',
        v_user_id
      )
      RETURNING id INTO v_movement_id;

      -- FIX: Usar quantidade_disponivel (nao `quantidade` que nao existe)
      -- quantidade_disponivel ja foi decrementada na reserva, entao:
      -- So liberar a quantidade_reservada (reserved → consumed)
      UPDATE lotes
        SET quantidade_reservada = GREATEST(COALESCE(quantidade_reservada, 0) - v_total_consumed, 0)
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
            'Producao concluida - Lote: ' || v_batch_number);

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

GRANT EXECUTE ON FUNCTION public.complete_production TO authenticated;

-- ============================================================
-- 2. CHECK CONSTRAINT: proteger estoque negativo
-- ============================================================
-- So adiciona se ainda nao existir (evitar erro em re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'lotes_quantidade_disponivel_check'
  ) THEN
    ALTER TABLE lotes ADD CONSTRAINT lotes_quantidade_disponivel_check
      CHECK (quantidade_disponivel >= 0);
  END IF;
END $$;

-- ============================================================
-- 3. Fix: consumir_fefo — adicionar overload com params do front-end
-- ============================================================
-- O front-end (lib/estoque/fefo.ts) chama com:
--   p_produto_id, p_quantidade, p_user_id, p_movimento_tipo, p_ordem_id
-- Mas a function existente so aceita:
--   p_produto_id, p_quantidade, p_usuario_id, p_observacao
-- Criamos overload que aceita os 5 params e ignora os extras
CREATE OR REPLACE FUNCTION public.consumir_fefo(
  p_produto_id UUID,
  p_quantidade NUMERIC,
  p_user_id UUID,
  p_movimento_tipo TEXT DEFAULT 'saida',
  p_ordem_id UUID DEFAULT NULL
)
RETURNS JSONB
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_lote RECORD;
  v_resto NUMERIC;
  v_consumido NUMERIC;
  v_result JSONB := '[]'::JSONB;
  v_total_disp NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'consumir_fefo: nao autenticado';
  END IF;

  SELECT COALESCE(SUM(quantidade_disponivel), 0) INTO v_total_disp
  FROM lotes
  WHERE produto_id = p_produto_id AND quantidade_disponivel > 0;

  IF v_total_disp < p_quantidade THEN
    RAISE EXCEPTION 'consumir_fefo: estoque insuficiente (disponivel: %, solicitado: %)', v_total_disp, p_quantidade;
  END IF;

  v_resto := p_quantidade;

  FOR v_lote IN
    SELECT id, quantidade_disponivel, numero_lote
    FROM lotes
    WHERE produto_id = p_produto_id AND quantidade_disponivel > 0
    ORDER BY data_validade ASC NULLS LAST
    FOR UPDATE
  LOOP
    EXIT WHEN v_resto <= 0;

    v_consumido := LEAST(v_resto, v_lote.quantidade_disponivel);

    UPDATE lotes SET quantidade_disponivel = quantidade_disponivel - v_consumido
    WHERE id = v_lote.id;

    INSERT INTO movimentacoes (produto_id, lote_id, tipo_movimentacao, quantidade, usuario_id, observacao)
    VALUES (p_produto_id, v_lote.id, 'saida', v_consumido, p_user_id,
            'Consumo FEFO - Lote ' || v_lote.numero_lote);

    v_result := v_result || JSONB_BUILD_OBJECT(
      'loteId', v_lote.id,
      'quantidade', v_consumido,
      'numero_lote', v_lote.numero_lote
    );

    v_resto := v_resto - v_consumido;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'success', true,
    'lotesConsumidos', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_fefo(UUID, NUMERIC, UUID, TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consumir_fefo(UUID, NUMERIC, UUID, TEXT, UUID) TO authenticated;

-- Tambem manter function antiga para compatibilidade
-- (ja existe com 4 params, manter como esta)
