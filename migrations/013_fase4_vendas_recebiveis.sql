-- ============================================================
-- CLJ Clinica — Fase 4: Vendas + Contas a Receber
-- accounts_receivable, receipts, customer_advances
-- ============================================================

-- ============================================
-- 4.1 accounts_receivable
-- ============================================
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID,
  sale_id UUID REFERENCES vendas(id),
  compounding_order_id UUID REFERENCES compounding_orders(id),
  description TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  original_amount NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC GENERATED ALWAYS AS (original_amount - discount_amount + interest_amount - received_amount) STORED,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT','PENDING','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','REFUNDED','PARTIALLY_REFUNDED')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ar_sale ON accounts_receivable(sale_id);
CREATE INDEX IF NOT EXISTS idx_ar_compounding ON accounts_receivable(compounding_order_id);
CREATE INDEX IF NOT EXISTS idx_ar_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_patient ON accounts_receivable(patient_id);

-- ============================================
-- 4.2 receipts (recebimentos)
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  account_receivable_id UUID REFERENCES accounts_receivable(id),
  sale_id UUID REFERENCES vendas(id),
  patient_id UUID,
  financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('dinheiro','cartao_credito','cartao_debito','pix','boleto','convenio','transferencia','deposito','outros')),
  amount NUMERIC NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_receipts_ar ON receipts(account_receivable_id);

-- ============================================
-- 4.3 customer_advances (adiantamentos)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID,
  compounding_order_id UUID REFERENCES compounding_orders(id),
  sale_id UUID REFERENCES vendas(id),
  amount NUMERIC NOT NULL,
  applied_amount NUMERIC NOT NULL DEFAULT 0,
  refunded_amount NUMERIC NOT NULL DEFAULT 0,
  available_amount NUMERIC GENERATED ALWAYS AS (amount - applied_amount - refunded_amount) STORED,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','PARTIALLY_APPLIED','APPLIED','PARTIALLY_REFUNDED','REFUNDED','CANCELLED')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_advances ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4.4 RLS POLICIES
-- ============================================
DROP POLICY IF EXISTS ar_select ON accounts_receivable; DROP POLICY IF EXISTS ar_insert ON accounts_receivable; DROP POLICY IF EXISTS ar_update ON accounts_receivable;
CREATE POLICY ar_select ON accounts_receivable FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY ar_insert ON accounts_receivable FOR INSERT WITH CHECK (current_user_role() IN ('administrador','financeiro'));
CREATE POLICY ar_update ON accounts_receivable FOR UPDATE USING (current_user_role() IN ('administrador','financeiro'));

DROP POLICY IF EXISTS rct_select ON receipts; DROP POLICY IF EXISTS rct_insert ON receipts;
CREATE POLICY rct_select ON receipts FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY rct_insert ON receipts FOR INSERT WITH CHECK (current_user_role() IN ('administrador','financeiro'));

DROP POLICY IF EXISTS ca_select ON customer_advances; DROP POLICY IF EXISTS ca_insert ON customer_advances; DROP POLICY IF EXISTS ca_update ON customer_advances;
CREATE POLICY ca_select ON customer_advances FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','financeiro'));
CREATE POLICY ca_insert ON customer_advances FOR INSERT WITH CHECK (current_user_role() IN ('administrador','financeiro'));
CREATE POLICY ca_update ON customer_advances FOR UPDATE USING (current_user_role() IN ('administrador','financeiro'));

-- ============================================
-- 4.5 Trigger: criar AR automaticamente ao criar venda
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_account_receivable()
RETURNS TRIGGER SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_clinic_id UUID;
BEGIN
  SELECT '00000000-0000-0000-0000-000000000000' INTO v_clinic_id; -- temporary
  INSERT INTO accounts_receivable(clinic_id,sale_id,patient_id,description,due_date,original_amount,created_by)
  VALUES(v_clinic_id,NEW.id,NEW.paciente_id,'Venda '||NEW.id,NEW.data_venda::DATE + INTERVAL '30 days',NEW.valor_total,NEW.usuario_id);
  INSERT INTO business_events(event_type,source_type,source_id,created_by)
  VALUES('SALE_CREATED','vendas',NEW.id::text,NEW.usuario_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_create_ar ON vendas;
CREATE TRIGGER trg_auto_create_ar AFTER INSERT ON vendas FOR EACH ROW EXECUTE FUNCTION auto_create_account_receivable();

-- ============================================
-- 4.6 RPC: register_receipt
-- ============================================
CREATE OR REPLACE FUNCTION public.register_receipt(
  p_account_receivable_id UUID, p_financial_account_id UUID,
  p_amount NUMERIC, p_payment_method TEXT DEFAULT 'dinheiro',
  p_transaction_reference TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_rct_id UUID; v_ar RECORD; v_clinic_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'register_receipt: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'register_receipt: permissao negada'; END IF;
  SELECT * INTO v_ar FROM accounts_receivable WHERE id=p_account_receivable_id FOR UPDATE;
  IF v_ar.id IS NULL THEN RAISE EXCEPTION 'register_receipt: conta nao encontrada'; END IF;
  IF v_ar.status='PAID' THEN RAISE EXCEPTION 'register_receipt: ja paga'; END IF;
  IF (v_ar.received_amount + p_amount) > (v_ar.original_amount - v_ar.discount_amount + v_ar.interest_amount) THEN
    RAISE EXCEPTION 'register_receipt: valor excede devido'; END IF;
  v_clinic_id:=v_ar.clinic_id;
  INSERT INTO receipts(clinic_id,account_receivable_id,financial_account_id,payment_method,amount,received_at,transaction_reference,notes,created_by)
  VALUES(v_clinic_id,p_account_receivable_id,p_financial_account_id,p_payment_method,p_amount,NOW(),p_transaction_reference,p_notes,v_user_id) RETURNING id INTO v_rct_id;
  UPDATE accounts_receivable SET received_amount = received_amount + p_amount, updated_at = NOW() WHERE id = p_account_receivable_id;
  IF v_ar.received_amount + p_amount >= (v_ar.original_amount - v_ar.discount_amount + v_ar.interest_amount) THEN
    UPDATE accounts_receivable SET status = 'PAID' WHERE id = p_account_receivable_id;
  ELSE
    UPDATE accounts_receivable SET status = 'PARTIALLY_PAID' WHERE id = p_account_receivable_id;
  END IF;
  INSERT INTO financial_entries(clinic_id,financial_account_id,entry_type,amount,source_type,source_id,description,created_by)
  VALUES(v_clinic_id,p_financial_account_id,'INFLOW',p_amount,'receipts',v_rct_id::text,'Recebimento venda',v_user_id);
  UPDATE financial_accounts SET balance = balance + p_amount WHERE id = p_financial_account_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('PAYMENT_RECEIVED','receipts',v_rct_id::text,v_user_id);
  RETURN v_rct_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.register_receipt TO authenticated;

-- ============================================
-- 4.7 RPC: register_customer_advance
-- ============================================
CREATE OR REPLACE FUNCTION public.register_customer_advance(
  p_patient_id UUID, p_amount NUMERIC, p_compounding_order_id UUID DEFAULT NULL,
  p_financial_account_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_ca_id UUID;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'register_advance: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'register_advance: permissao negada'; END IF;
  INSERT INTO customer_advances(clinic_id,patient_id,compounding_order_id,amount,notes,created_by)
  VALUES('00000000-0000-0000-0000-000000000000',p_patient_id,p_compounding_order_id,p_amount,p_notes,v_user_id) RETURNING id INTO v_ca_id;
  IF p_financial_account_id IS NOT NULL THEN
    INSERT INTO financial_entries(clinic_id,financial_account_id,entry_type,amount,source_type,source_id,description,created_by)
    VALUES('00000000-0000-0000-0000-000000000000',p_financial_account_id,'INFLOW',p_amount,'customer_advances',v_ca_id::text,'Adiantamento cliente',v_user_id);
    UPDATE financial_accounts SET balance = balance + p_amount WHERE id = p_financial_account_id;
  END IF;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('ADVANCE_RECEIVED','customer_advances',v_ca_id::text,v_user_id);
  RETURN v_ca_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.register_customer_advance TO authenticated;

-- ============================================
-- 4.8 RPC: apply_customer_advance
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_customer_advance(
  p_advance_id UUID, p_sale_id UUID, p_amount NUMERIC
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_ca RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'apply_advance: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'apply_advance: permissao negada'; END IF;
  SELECT * INTO v_ca FROM customer_advances WHERE id=p_advance_id FOR UPDATE;
  IF v_ca.id IS NULL THEN RAISE EXCEPTION 'apply_advance: adiantamento nao encontrado'; END IF;
  IF (v_ca.applied_amount + p_amount) > v_ca.amount THEN RAISE EXCEPTION 'apply_advance: valor excede adiantamento'; END IF;
  UPDATE customer_advances SET applied_amount = applied_amount + p_amount,
    status = CASE WHEN applied_amount + p_amount >= amount THEN 'APPLIED' ELSE 'PARTIALLY_APPLIED' END
    WHERE id = p_advance_id;
  UPDATE vendas SET valor_total = GREATEST(valor_total - p_amount, 0) WHERE id = p_sale_id;
  INSERT INTO business_events(event_type,source_type,source_id,created_by) VALUES('ADVANCE_APPLIED','customer_advances',p_advance_id::text,v_user_id);
  RETURN p_advance_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_customer_advance TO authenticated;

-- ============================================
-- 4.9 RPC: refund_customer
-- ============================================
CREATE OR REPLACE FUNCTION public.refund_customer(
  p_sale_id UUID, p_amount NUMERIC, p_reason TEXT,
  p_financial_account_id UUID
) RETURNS UUID SET search_path = public SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE v_user_id UUID; v_role TEXT; v_ar_id UUID; v_ar RECORD;
BEGIN
  v_user_id:=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'refund: nao autenticado'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('administrador','financeiro') THEN RAISE EXCEPTION 'refund: permissao negada'; END IF;
  SELECT id INTO v_ar_id FROM accounts_receivable WHERE sale_id=p_sale_id;
  IF v_ar_id IS NOT NULL THEN
    SELECT * INTO v_ar FROM accounts_receivable WHERE id=v_ar_id FOR UPDATE;
    UPDATE accounts_receivable SET status='REFUNDED',updated_at=NOW() WHERE id=v_ar_id;
  END IF;
  INSERT INTO business_events(event_type,source_type,source_id,created_by)
    VALUES('CUSTOMER_REFUND_COMPLETED','vendas',p_sale_id::text,v_user_id);
  INSERT INTO financial_entries(clinic_id,financial_account_id,entry_type,amount,source_type,source_id,description,created_by)
    VALUES('00000000-0000-0000-0000-000000000000',p_financial_account_id,'OUTFLOW',p_amount,'vendas',p_sale_id::text,'Reembolso venda: '||p_reason,v_user_id);
  UPDATE financial_accounts SET balance = balance - p_amount WHERE id = p_financial_account_id;
  RETURN p_sale_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.refund_customer TO authenticated;

-- ============================================================
-- FIM FASE 4
-- ============================================================
