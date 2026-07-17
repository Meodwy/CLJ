-- ============================================================
-- CLJ Clinica — Fase 2: Compras + Contas a Pagar
-- purchase_orders, goods_receipts, accounts_payable, financial
-- ============================================================

-- ============================================
-- 2.1 PURCHASE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  supplier_id UUID REFERENCES fornecedores(id),
  internal_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
  expected_total NUMERIC DEFAULT 0,
  expected_delivery_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, internal_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES produtos(id),
  ordered_quantity NUMERIC NOT NULL,
  received_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  expected_unit_cost NUMERIC DEFAULT 0,
  expected_total_cost NUMERIC GENERATED ALWAYS AS (ordered_quantity * expected_unit_cost) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);

-- ============================================
-- 2.2 GOODS RECEIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID REFERENCES fornecedores(id),
  receipt_number TEXT,
  document_number TEXT,
  document_type TEXT DEFAULT 'NFE' CHECK (document_type IN ('NFE','CFE','NOTA','OUTRO')),
  received_by UUID REFERENCES profiles(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES purchase_order_items(id),
  product_id UUID NOT NULL REFERENCES produtos(id),
  lot_id UUID REFERENCES lotes(id),
  received_quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  total_cost NUMERIC GENERATED ALWAYS AS (received_quantity * COALESCE(unit_cost, 0)) STORED,
  manufacturing_date DATE,
  expiration_date DATE,
  lot_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2.3 FINANCIAL ACCOUNTS (Caixa/Bancos)
-- ============================================
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('CASH','BANK','DIGITAL_WALLET','RECEIVABLE_CLEARING','PAYABLE_CLEARING')),
  balance NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2.4 FINANCIAL ENTRIES (Razao AppAndOnly)
-- ============================================
CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INFLOW','OUTFLOW','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT')),
  amount NUMERIC NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  business_event_id UUID REFERENCES business_events(id),
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_financial_entries_source ON financial_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_account ON financial_entries(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_occurred ON financial_entries(occurred_at DESC);

-- Append-only
REVOKE UPDATE, DELETE ON financial_entries FROM authenticated, anon, public;

-- ============================================
-- 2.5 ACCOUNTS PAYABLE
-- ============================================
CREATE TABLE IF NOT EXISTS accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  supplier_id UUID REFERENCES fornecedores(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  goods_receipt_id UUID REFERENCES goods_receipts(id),
  document_number TEXT,
  description TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  original_amount NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  fine_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC GENERATED ALWAYS AS (original_amount - discount_amount + interest_amount + fine_amount - paid_amount) STORED,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT','PENDING','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','DISPUTED')),
  cost_center_id UUID REFERENCES cost_centers(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payable_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  account_payable_id UUID NOT NULL REFERENCES accounts_payable(id),
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;

-- Prevent double payment trigger
CREATE OR REPLACE FUNCTION prevent_payable_overpayment()
RETURNS TRIGGER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_ap RECORD;
BEGIN
  SELECT * INTO v_ap FROM accounts_payable WHERE id = NEW.account_payable_id FOR UPDATE;
  IF (v_ap.paid_amount + NEW.amount) > (v_ap.original_amount - v_ap.discount_amount + v_ap.interest_amount + v_ap.fine_amount) THEN
    RAISE EXCEPTION 'prevent_payable_overpayment: pagamento excede valor da conta a pagar (devido: %, pagamento: %)',
      (v_ap.original_amount - v_ap.discount_amount + v_ap.interest_amount + v_ap.fine_amount - v_ap.paid_amount), NEW.amount;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_payable_overpayment ON payable_payments;
CREATE TRIGGER trg_prevent_payable_overpayment
  BEFORE INSERT ON payable_payments FOR EACH ROW EXECUTE FUNCTION prevent_payable_overpayment();

-- Atualizar status AP apos pagamento
CREATE OR REPLACE FUNCTION update_account_payable_on_payment()
RETURNS TRIGGER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_new_paid NUMERIC; v_total NUMERIC;
BEGIN
  UPDATE accounts_payable SET paid_amount = paid_amount + NEW.amount, updated_at = NOW() WHERE id = NEW.account_payable_id;
  SELECT paid_amount, original_amount - discount_amount + interest_amount + fine_amount INTO v_new_paid, v_total FROM accounts_payable WHERE id = NEW.account_payable_id;
  IF v_new_paid >= v_total THEN
    UPDATE accounts_payable SET status = 'PAID' WHERE id = NEW.account_payable_id;
  ELSIF v_new_paid > 0 THEN
    UPDATE accounts_payable SET status = 'PARTIALLY_PAID' WHERE id = NEW.account_payable_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_update_ap_on_payment ON payable_payments;
CREATE TRIGGER trg_update_ap_on_payment
  AFTER INSERT ON payable_payments FOR EACH ROW EXECUTE FUNCTION update_account_payable_on_payment();

-- ============================================
-- 2.6 DEFAULT DATA
-- ============================================
INSERT INTO cost_centers (clinic_id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Estoque', 'STOCK'),
  ('00000000-0000-0000-0000-000000000000', 'Manipulacao', 'COMPOUNDING'),
  ('00000000-0000-0000-0000-000000000000', 'Farmacia', 'PHARMACY'),
  ('00000000-0000-0000-0000-000000000000', 'Recepcao', 'RECEPTION'),
  ('00000000-0000-0000-0000-000000000000', 'Administracao', 'ADMINISTRATION')
ON CONFLICT DO NOTHING;

INSERT INTO financial_accounts (clinic_id, name, account_type) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Caixa', 'CASH'),
  ('00000000-0000-0000-0000-000000000000', 'Conta Corrente', 'BANK')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2.7 RLS POLICIES
-- ============================================

-- Helper: get user clinic (via profiles)
CREATE OR REPLACE FUNCTION public.user_clinic_id()
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN RETURN '00000000-0000-0000-0000-000000000000'; END; $$;

-- purchase_orders RLS
DROP POLICY IF EXISTS po_select ON purchase_orders; DROP POLICY IF EXISTS po_insert ON purchase_orders; DROP POLICY IF EXISTS po_update ON purchase_orders;
CREATE POLICY po_select ON purchase_orders FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY po_insert ON purchase_orders FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));
CREATE POLICY po_update ON purchase_orders FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- purchase_order_items RLS
DROP POLICY IF EXISTS poi_select ON purchase_order_items; DROP POLICY IF EXISTS poi_insert ON purchase_order_items;
CREATE POLICY poi_select ON purchase_order_items FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY poi_insert ON purchase_order_items FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));
CREATE POLICY poi_update ON purchase_order_items FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- goods_receipts RLS
DROP POLICY IF EXISTS gr_select ON goods_receipts; DROP POLICY IF EXISTS gr_insert ON goods_receipts;
CREATE POLICY gr_select ON goods_receipts FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','estoquista'));
CREATE POLICY gr_insert ON goods_receipts FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','estoquista'));

-- financial_accounts RLS
DROP POLICY IF EXISTS fa_select ON financial_accounts;
CREATE POLICY fa_select ON financial_accounts FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));

-- financial_entries RLS
DROP POLICY IF EXISTS fe_select ON financial_entries; DROP POLICY IF EXISTS fe_insert ON financial_entries;
CREATE POLICY fe_select ON financial_entries FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY fe_insert ON financial_entries FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','financeiro'));

-- accounts_payable RLS
DROP POLICY IF EXISTS ap_select ON accounts_payable; DROP POLICY IF EXISTS ap_insert ON accounts_payable; DROP POLICY IF EXISTS ap_update ON accounts_payable;
CREATE POLICY ap_select ON accounts_payable FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY ap_insert ON accounts_payable FOR INSERT WITH CHECK (current_user_role() IN ('administrador','financeiro'));
CREATE POLICY ap_update ON accounts_payable FOR UPDATE USING (current_user_role() IN ('administrador','financeiro'));

-- payable_payments RLS
DROP POLICY IF EXISTS pp_select ON payable_payments; DROP POLICY IF EXISTS pp_insert ON payable_payments;
CREATE POLICY pp_select ON payable_payments FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY pp_insert ON payable_payments FOR INSERT WITH CHECK (current_user_role() IN ('administrador','financeiro'));

-- cost_centers RLS
DROP POLICY IF EXISTS cc_select ON cost_centers;
CREATE POLICY cc_select ON cost_centers FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));

-- ============================================
-- 2.8 RPC: create_purchase_order
-- ============================================
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id UUID, p_expected_delivery_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL, p_items JSONB DEFAULT '[]'
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_po_id UUID; v_internal TEXT; v_seq INTEGER; v_yr TEXT;
  v_item JSONB;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'create_purchase_order: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'create_purchase_order: permissao negada'; END IF;
  v_yr := TO_CHAR(NOW(),'YYYY');
  SELECT COALESCE(MAX(SPLIT_PART(internal_number,'-',3)::INTEGER),0)+1 INTO v_seq FROM purchase_orders WHERE internal_number LIKE 'PO-'||v_yr||'-%';
  v_internal := 'PO-'||v_yr||'-'||LPAD(v_seq::TEXT,4,'0');
  INSERT INTO purchase_orders(clinic_id,supplier_id,internal_number,status,expected_total,expected_delivery_at,notes,created_by)
  VALUES(user_clinic_id(),p_supplier_id,v_internal,'DRAFT',0,p_expected_delivery_at,p_notes,v_user_id) RETURNING id INTO v_po_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO purchase_order_items(purchase_order_id,product_id,ordered_quantity,unit,expected_unit_cost)
    VALUES(v_po_id,(v_item->>'product_id')::UUID,(v_item->>'ordered_quantity')::NUMERIC,v_item->>'unit',COALESCE((v_item->>'expected_unit_cost')::NUMERIC,0));
  END LOOP;
  UPDATE purchase_orders SET expected_total = (SELECT COALESCE(SUM(expected_total_cost),0) FROM purchase_order_items WHERE purchase_order_id = v_po_id) WHERE id = v_po_id;
  INSERT INTO business_events(clinic_id,event_type,source_type,source_id,created_by)
  VALUES(user_clinic_id(),'PURCHASE_ORDER_CREATED','purchase_orders',v_po_id::text,v_user_id);
  RETURN v_po_id;
END; $$;

-- ============================================
-- 2.9 RPC: receive_goods (cria lote + movimentacao + atualiza PO)
-- ============================================
CREATE OR REPLACE FUNCTION public.receive_goods(
  p_purchase_order_id UUID, p_items JSONB DEFAULT '[]',
  p_document_number TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_gr_id UUID; v_clinic_id UUID;
  v_item JSONB; v_lot_id UUID; v_po_status TEXT;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'receive_goods: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico','estoquista') THEN RAISE EXCEPTION 'receive_goods: permissao negada'; END IF;
  SELECT clinic_id INTO v_clinic_id FROM purchase_orders WHERE id = p_purchase_order_id;
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'receive_goods: ordem nao encontrada'; END IF;
  SELECT status INTO v_po_status FROM purchase_orders WHERE id = p_purchase_order_id;
  IF v_po_status IN ('RECEIVED','CANCELLED','CLOSED') THEN RAISE EXCEPTION 'receive_goods: ordem ja recebida/cancelada'; END IF;
  INSERT INTO goods_receipts(clinic_id,purchase_order_id,receipt_number,document_number,notes,received_by)
  VALUES(v_clinic_id,p_purchase_order_id,'GR-'||TO_CHAR(NOW(),'YYYYMMDD-HH24MISS'),p_document_number,p_notes,v_user_id) RETURNING id INTO v_gr_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO lotes(produto_id,numero_lote,data_fabricacao,data_validade,quantidade_recebida,quantidade_disponivel,custo_unitario,status)
    VALUES((v_item->>'product_id')::UUID,COALESCE(v_item->>'lot_number','LOT-'||gen_random_uuid()::text),(v_item->>'manufacturing_date')::DATE,(v_item->>'expiration_date')::DATE,(v_item->>'received_quantity')::NUMERIC,(v_item->>'received_quantity')::NUMERIC,(v_item->>'unit_cost')::NUMERIC,'RECEIVED') RETURNING id INTO v_lot_id;
    INSERT INTO goods_receipt_items(goods_receipt_id,purchase_order_item_id,product_id,lot_id,received_quantity,unit_cost,manufacturing_date,expiration_date,lot_number)
    VALUES(v_gr_id,(v_item->>'purchase_order_item_id')::UUID,(v_item->>'product_id')::UUID,v_lot_id,(v_item->>'received_quantity')::NUMERIC,(v_item->>'unit_cost')::NUMERIC,(v_item->>'manufacturing_date')::DATE,(v_item->>'expiration_date')::DATE,v_item->>'lot_number');
    -- Update PO item received qty
    UPDATE purchase_order_items SET received_quantity = received_quantity + (v_item->>'received_quantity')::NUMERIC WHERE id = (v_item->>'purchase_order_item_id')::UUID;
  END LOOP;
  -- Update PO status
  IF NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = p_purchase_order_id AND received_quantity < ordered_quantity) THEN
    UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = p_purchase_order_id;
  ELSE
    UPDATE purchase_orders SET status = 'PARTIALLY_RECEIVED' WHERE id = p_purchase_order_id;
  END IF;
  INSERT INTO business_events(clinic_id,event_type,source_type,source_id,created_by)
  VALUES(v_clinic_id,'GOODS_RECEIVED','goods_receipts',v_gr_id::text,v_user_id);
  RETURN v_gr_id;
END; $$;

-- ============================================
-- 2.10 RPC: approve_lot (RECEIVED/QUARANTINE -> APPROVED)
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_inventory_lot(p_lot_id UUID)
RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'approve_lot: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'approve_lot: permissao negada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM lotes WHERE id = p_lot_id AND status IN ('RECEIVED','QUARANTINE','UNDER_ANALYSIS')) THEN
    RAISE EXCEPTION 'approve_lot: status invalido para aprovacao'; END IF;
  UPDATE lotes SET status = 'APPROVED' WHERE id = p_lot_id;
  INSERT INTO business_events(clinic_id:=COALESCE,(SELECT p_clinic_id FROM...)...,...);
  RETURN p_lot_id;
END; $$;

-- Quick version
CREATE OR REPLACE FUNCTION public.approve_lot(p_lot_id UUID) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_prod_id UUID; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'approve_lot: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','farmaceutico') THEN RAISE EXCEPTION 'approve_lot: so farmaceutico'; END IF;
  SELECT produto_id INTO v_prod_id FROM lotes WHERE id=p_lot_id AND status IN('RECEIVED','QUARANTINE','UNDER_ANALYSIS');
  IF v_prod_id IS NULL THEN RAISE EXCEPTION 'approve_lot: lote nao encontrado ou status invalido'; END IF;
  UPDATE lotes SET status='APPROVED' WHERE id=p_lot_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('LOT_APPROVED','lotes',p_lot_id::text,v_user_id);
  RETURN p_lot_id;
END; $$;

-- ============================================
-- 2.11 RPC: create_account_payable
-- ============================================
CREATE OR REPLACE FUNCTION public.create_account_payable(
  p_supplier_id UUID, p_goods_receipt_id UUID, p_document_number TEXT,
  p_description TEXT, p_due_date DATE, p_original_amount NUMERIC,
  p_cost_center_id UUID DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_ap_id UUID; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'create_ap: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'create_ap: permissao negada'; END IF;
  SELECT clinic_id INTO v_clinic_id FROM goods_receipts WHERE id=p_goods_receipt_id;
  IF v_clinic_id IS NULL THEN RAISE EXCEPTION 'create_ap: recebimento nao encontrado'; END IF;
  INSERT INTO accounts_payable(clinic_id,supplier_id,goods_receipt_id,document_number,description,due_date,original_amount,cost_center_id,created_by)
  VALUES(v_clinic_id,p_supplier_id,p_goods_receipt_id,p_document_number,p_description,p_due_date,p_original_amount,p_cost_center_id,v_user_id) RETURNING id INTO v_ap_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('ACCOUNT_PAYABLE_CREATED','accounts_payable',v_ap_id::text,v_user_id);
  RETURN v_ap_id;
END; $$;

-- ============================================
-- 2.12 RPC: pay_account_payable
-- ============================================
CREATE OR REPLACE FUNCTION public.pay_account_payable(
  p_account_payable_id UUID, p_financial_account_id UUID,
  p_amount NUMERIC, p_paid_at TIMESTAMPTZ DEFAULT NOW(),
  p_transaction_reference TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_pp_id UUID; v_clinic_id UUID; v_ap RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'pay_ap: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'pay_ap: permissao negada'; END IF;
  SELECT * INTO v_ap FROM accounts_payable WHERE id=p_account_payable_id FOR UPDATE;
  IF v_ap.id IS NULL THEN RAISE EXCEPTION 'pay_ap: conta nao encontrada'; END IF;
  IF v_ap.status='PAID' THEN RAISE EXCEPTION 'pay_ap: ja paga'; END IF;
  v_clinic_id:=v_ap.clinic_id;
  INSERT INTO payable_payments(clinic_id,account_payable_id,financial_account_id,amount,paid_at,transaction_reference,notes,created_by)
  VALUES(v_clinic_id,p_account_payable_id,p_financial_account_id,p_amount,p_paid_at,p_transaction_reference,p_notes,v_user_id) RETURNING id INTO v_pp_id;
  INSERT INTO financial_entries(clinic_id,financial_account_id,entry_type,amount,source_type,source_id,description,created_by)
  VALUES(v_clinic_id,p_financial_account_id,'OUTFLOW',p_amount,'payable_payments',v_pp_id::text,'Pagamento conta: '||v_ap.description,v_user_id);
  UPDATE financial_accounts SET balance = balance - p_amount WHERE id = p_financial_account_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('SUPPLIER_PAYMENT_RECORDED','payable_payments',v_pp_id::text,v_user_id);
  RETURN v_pp_id;
END; $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_purchase_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_goods TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_lot TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_payable TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_account_payable TO authenticated;

-- ============================================================
-- FIM FASE 2
-- ============================================================
