-- ============================================================
-- CLJ Clinica — Fase 5: Devolucoes, Ajustes, Inventario Fisico
-- ============================================================

-- 5.1 supplier_returns
CREATE TABLE IF NOT EXISTS supplier_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  supplier_id UUID REFERENCES fornecedores(id),
  goods_receipt_id UUID REFERENCES goods_receipts(id),
  return_number TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','CANCELLED')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lotes(id),
  product_id UUID NOT NULL REFERENCES produtos(id),
  returned_quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS supplier_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  supplier_id UUID REFERENCES fornecedores(id),
  supplier_return_id UUID REFERENCES supplier_returns(id),
  credit_type TEXT NOT NULL CHECK (credit_type IN ('REFUND','CREDIT_NOTE','FUTURE_DISCOUNT')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPLIED','EXPIRED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_credits ENABLE ROW LEVEL SECURITY;

-- 5.2 inventory_counts (inventario fisico)
CREATE TABLE IF NOT EXISTS inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  count_number TEXT NOT NULL,
  counted_by UUID REFERENCES profiles(id),
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES produtos(id),
  lot_id UUID REFERENCES lotes(id),
  system_quantity NUMERIC NOT NULL,
  physical_quantity NUMERIC NOT NULL,
  difference_quantity NUMERIC GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  unit_cost NUMERIC,
  difference_cost NUMERIC GENERATED ALWAYS AS ((physical_quantity - system_quantity) * COALESCE(unit_cost, 0)) STORED,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS sr_select ON supplier_returns; DROP POLICY IF EXISTS sr_insert ON supplier_returns;
CREATE POLICY sr_select ON supplier_returns FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY sr_insert ON supplier_returns FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

DROP POLICY IF EXISTS ic_select ON inventory_counts; DROP POLICY IF EXISTS ic_insert ON inventory_counts; DROP POLICY IF EXISTS ic_update ON inventory_counts;
CREATE POLICY ic_select ON inventory_counts FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY ic_insert ON inventory_counts FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY ic_update ON inventory_counts FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- RPC: close_inventory_count (apply adjustments)
CREATE OR REPLACE FUNCTION public.close_inventory_count(p_count_id UUID) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_item RECORD; v_diff NUMERIC;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'close_count: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'close_count: permissao negada'; END IF;
  FOR v_item IN SELECT ci.* FROM inventory_count_items ci WHERE ci.inventory_count_id=p_count_id LOOP
    SELECT (v_item.physical_quantity - v_item.system_quantity) INTO v_diff;
    IF v_diff != 0 THEN
      UPDATE lotes SET quantidade_disponivel = GREATEST(quantidade_disponivel + v_diff, 0) WHERE id = v_item.lot_id;
      INSERT INTO movimentacoes(produto_id,lote_id,tipo_movimentacao,quantidade,usuario_id,observacao,created_at)
      VALUES(v_item.product_id,v_item.lot_id,'ajuste',v_diff,v_user_id,'Ajuste inventario fisico: '||COALESCE(v_item.reason,''),NOW());
    END IF;
  END LOOP;
  UPDATE inventory_counts SET status='COMPLETED' WHERE id=p_count_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('INVENTORY_ADJUSTED','inventory_counts',p_count_id::text,v_user_id);
  RETURN p_count_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.close_inventory_count TO authenticated;

-- FIM FASE 5
