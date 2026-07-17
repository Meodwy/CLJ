-- ============================================================
-- CLJ Clinica — Fase 1: Fundacao
-- Add blocked_quantity, business_events, inventory view, constraints
-- ============================================================

-- 1. ADD blocked_quantity TO lotes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS quantidade_bloqueada NUMERIC NOT NULL DEFAULT 0;
COMMENT ON COLUMN lotes.quantidade_bloqueada IS 'Quantidade bloqueada (qualidade/rejeicao)';

-- 2. CREATE business_events TABLE (append-only audit trail)
CREATE TABLE IF NOT EXISTS business_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED','ROLLED_BACK')),
  payload JSONB DEFAULT '{}',
  error_data JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_events_source ON business_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_business_events_type ON business_events(event_type);
CREATE INDEX IF NOT EXISTS idx_business_events_created ON business_events(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_events_idempotency ON business_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;

-- RLS: admins and pharma can see all, others only own clinic
DROP POLICY IF EXISTS business_events_select ON business_events;
CREATE POLICY business_events_select ON business_events
  FOR SELECT USING (
    current_user_role() IN ('administrador','farmaceutico')
    OR EXISTS (SELECT 1 FROM compounding_orders co WHERE co.id::text = source_id AND source_type = 'compounding_orders')
  );

-- Append-only: no update/delete on business_events
REVOKE UPDATE, DELETE ON business_events FROM authenticated, anon, public;

-- 3. CREATE product_inventory_balances VIEW
CREATE OR REPLACE VIEW product_inventory_balances AS
SELECT
  p.id AS product_id,
  p.nome AS product_name,
  p.unidade_medida AS unit,
  COALESCE(SUM(l.quantidade_recebida), 0) AS physical_quantity,
  COALESCE(SUM(l.quantidade_reservada), 0) AS reserved_quantity,
  COALESCE(SUM(l.quantidade_bloqueada), 0) AS blocked_quantity,
  COALESCE(SUM(l.quantidade_disponivel), 0) AS available_quantity,
  COALESCE(AVG(l.custo_unitario) FILTER (WHERE l.custo_unitario IS NOT NULL AND l.status = 'APPROVED'), 0) AS average_unit_cost,
  COALESCE(SUM(l.quantidade_disponivel * COALESCE(l.custo_unitario, 0)), 0) AS inventory_value,
  p.estoque_minimo,
  p.estoque_maximo,
  COUNT(l.id) FILTER (WHERE l.status = 'APPROVED') AS active_lot_count,
  COUNT(l.id) FILTER (WHERE l.data_validade IS NOT NULL AND l.data_validade <= CURRENT_DATE + INTERVAL '30 days' AND l.data_validade >= CURRENT_DATE AND l.quantidade_disponivel > 0) AS lots_expiring_soon
FROM produtos p
LEFT JOIN lotes l ON l.produto_id = p.id
WHERE p.ativo = true
GROUP BY p.id, p.nome, p.unidade_medida, p.estoque_minimo, p.estoque_maximo;

COMMENT ON VIEW product_inventory_balances IS 'Saldos de estoque calculados dos lotes (fonte unica de verdade)';

GRANT SELECT ON product_inventory_balances TO authenticated;

-- 4. APPEND-ONLY CONSTRAINTS ON movimentacoes
REVOKE UPDATE, DELETE ON movimentacoes FROM authenticated, anon, public;
ALTER TABLE movimentacoes ALTER COLUMN created_at SET DEFAULT NOW();
-- Trigger to prevent UPDATE/DELETE at DB level
CREATE OR REPLACE FUNCTION prevent_movimentacoes_modification()
RETURNS TRIGGER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'movimentacoes is append-only: updates and deletes are not allowed';
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_movimentacoes_update ON movimentacoes;
CREATE TRIGGER trg_prevent_movimentacoes_update
  BEFORE UPDATE ON movimentacoes FOR EACH ROW EXECUTE FUNCTION prevent_movimentacoes_modification();

DROP TRIGGER IF EXISTS trg_prevent_movimentacoes_delete ON movimentacoes;
CREATE TRIGGER trg_prevent_movimentacoes_delete
  BEFORE DELETE ON movimentacoes FOR EACH ROW EXECUTE FUNCTION prevent_movimentacoes_modification();

-- Same for inventory_movements
REVOKE UPDATE, DELETE ON inventory_movements FROM authenticated, anon, public;

DROP TRIGGER IF EXISTS trg_prevent_inventory_movements_update ON inventory_movements;
CREATE TRIGGER trg_prevent_inventory_movements_update
  BEFORE UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION prevent_movimentacoes_modification();

DROP TRIGGER IF EXISTS trg_prevent_inventory_movements_delete ON inventory_movements;
CREATE TRIGGER trg_prevent_inventory_movements_delete
  BEFORE DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION prevent_movimentacoes_modification();

-- 5. FIX lot creation ON compra — set status to 'RECEIVED'
CREATE OR REPLACE FUNCTION fix_lote_status_on_purchase()
RETURNS TRIGGER SET search_path = public LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'RECEIVED'::lot_status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fix_lote_status ON lotes;
CREATE TRIGGER trg_fix_lote_status
  BEFORE INSERT ON lotes FOR EACH ROW EXECUTE FUNCTION fix_lote_status_on_purchase();

-- 6. UPDATE existing lotes with NULL status to 'RECEIVED'
UPDATE lotes SET status = 'RECEIVED' WHERE status IS NULL;

-- 7. SALDO NEGATIVO constraint on lotes
ALTER TABLE lotes DROP CONSTRAINT IF EXISTS lotes_quantidade_disponivel_check;
ALTER TABLE lotes ADD CONSTRAINT lotes_quantidade_disponivel_check
  CHECK (quantidade_disponivel >= 0);

ALTER TABLE lotes DROP CONSTRAINT IF EXISTS lotes_quantidade_reservada_check;
ALTER TABLE lotes ADD CONSTRAINT lotes_quantidade_reservada_check
  CHECK (quantidade_reservada >= 0);

ALTER TABLE lotes DROP CONSTRAINT IF EXISTS lotes_quantidade_bloqueada_check;
ALTER TABLE lotes ADD CONSTRAINT lotes_quantidade_bloqueada_check
  CHECK (quantidade_bloqueada >= 0);

-- Update trigger produtos.saldo_atual to use calculated sum (safety net)
CREATE OR REPLACE FUNCTION atualizar_saldo_produto()
RETURNS TRIGGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE produtos
  SET saldo_atual = (
    SELECT COALESCE(SUM(quantidade_disponivel), 0)
    FROM lotes
    WHERE produto_id = COALESCE(NEW.produto_id, OLD.produto_id)
  )
  WHERE id = COALESCE(NEW.produto_id, OLD.produto_id);
  RETURN COALESCE(NEW, OLD);
END; $$;

-- Ensure trigger exists on lotes for saldo updates
DROP TRIGGER IF EXISTS trg_atualizar_saldo ON lotes;
CREATE TRIGGER trg_atualizar_saldo
  AFTER INSERT OR UPDATE OF quantidade_disponivel, quantidade_recebida, quantidade_reservada, quantidade_bloqueada OR DELETE
  ON lotes FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_produto();

-- ============================================================
-- FIM FASE 1
-- ============================================================
