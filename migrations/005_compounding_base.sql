-- ============================================================
-- CLJ Clínica — Módulo Manipulação (Compounding)
-- Migration 005_compounding_base.sql
-- ============================================================

-- 1. ENUMS
CREATE TYPE compounding_order_status AS ENUM (
  'DRAFT','AWAITING_PHARMACEUTICAL_REVIEW','PRESCRIPTION_PENDING','PRESCRIPTION_REJECTED',
  'APPROVED_FOR_PRODUCTION','CHECKING_STOCK','MISSING_STOCK','AWAITING_PURCHASE','STOCK_RESERVED',
  'QUEUED_FOR_PRODUCTION','IN_SEPARATION','AWAITING_WEIGHING','IN_WEIGHING','IN_COMPOUNDING',
  'IN_PROCESS_CONTROL','AWAITING_PACKAGING','IN_PACKAGING','AWAITING_LABELING','IN_LABELING',
  'PRODUCTION_COMPLETED','AWAITING_FINAL_QUALITY_CONTROL','QUALITY_CONTROL_REJECTED','QUARANTINED',
  'REWORK_REQUIRED','AWAITING_PHARMACIST_RELEASE','RELEASE_REJECTED','RELEASED_BY_PHARMACIST',
  'READY_FOR_PICKUP','OUT_FOR_DELIVERY','DISPENSED','CANCELLED','DESTROYED'
);

CREATE TYPE item_type AS ENUM (
  'ACTIVE_INGREDIENT','EXCIPIENT','VEHICLE','BASE','PACKAGING','LABEL','CONSUMABLE','CLEANING_MATERIAL','FINAL_PRODUCT'
);

CREATE TYPE lot_status AS ENUM (
  'RECEIVED','QUARANTINE','UNDER_ANALYSIS','APPROVED','REJECTED','BLOCKED','RECALLED','EXPIRED','DEPLETED','DISCARDED'
);

CREATE TYPE reservation_status AS ENUM ('ACTIVE','CONSUMED','PARTIALLY_CONSUMED','RELEASED','EXPIRED','CANCELLED');
CREATE TYPE separation_status AS ENUM ('PENDING','SEPARATED','CHECKED','DIVERGENT','CANCELLED');
CREATE TYPE weighing_status AS ENUM ('PENDING','RECORDED','VERIFIED','REJECTED','CANCELLED');
CREATE TYPE step_status AS ENUM ('PENDING','IN_PROGRESS','PAUSED','COMPLETED','SKIPPED','DEVIATED');
CREATE TYPE quality_status AS ENUM ('PENDING','APPROVED','REJECTED','NOT_APPLICABLE','REQUIRES_INVESTIGATION');
CREATE TYPE quality_decision AS ENUM ('APPROVED','REJECTED','QUARANTINED','REWORK_REQUIRED','INVESTIGATION_REQUIRED');
CREATE TYPE deviation_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE deviation_status AS ENUM ('OPEN','INVESTIGATION','CLOSED','CANCELLED');
CREATE TYPE release_decision AS ENUM ('APPROVED','REJECTED','QUARANTINED','REWORK_REQUIRED','INVESTIGATION_REQUIRED');
CREATE TYPE signature_method AS ENUM ('ADVANCED_ELECTRONIC_SIGNATURE','ICP_BRASIL_QUALIFIED_SIGNATURE');
CREATE TYPE priority_level AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE movement_type AS ENUM (
  'RECEIPT','APPROVAL','RESERVATION','RESERVATION_RELEASE','PRODUCTION_CONSUMPTION',
  'PRODUCTION_RETURN','PRODUCTION_LOSS','QUALITY_SAMPLE','DISCARD','ADJUSTMENT','TRANSFER','BLOCK','UNBLOCK','RECALL'
);
CREATE TYPE step_type AS ENUM (
  'PREPARATION','SIEVING','MIXING','HOMOGENIZATION','DILUTION','DISSOLUTION','HEATING','COOLING',
  'ENCAPSULATION','FILLING','FILTRATION','ENVASING','PACKAGING','LABELING','CLEANING','IN_PROCESS_CHECK','OTHER'
);

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 Compounding Orders
CREATE TABLE compounding_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  prescription_id UUID NOT NULL,
  prescription_version_id UUID NOT NULL,

  internal_number TEXT NOT NULL,
  final_batch_number TEXT,
  pharmaceutical_form TEXT NOT NULL,
  requested_quantity NUMERIC NOT NULL,
  requested_unit TEXT NOT NULL,

  status compounding_order_status NOT NULL DEFAULT 'DRAFT',
  priority priority_level NOT NULL DEFAULT 'NORMAL',

  pharmacist_id UUID REFERENCES profiles(id),
  assigned_manipulator_id UUID REFERENCES profiles(id),

  scheduled_start_at TIMESTAMPTZ,
  production_started_at TIMESTAMPTZ,
  production_completed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  dispensed_at TIMESTAMPTZ,

  due_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (clinic_id, internal_number)
);

-- 2.2 Compounding Formulas
CREATE TABLE compounding_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',

  formula_data JSONB NOT NULL,
  calculation_data JSONB NOT NULL,
  packaging_requirements JSONB,
  storage_requirements JSONB,
  warning_requirements JSONB,

  approved_by UUID,
  approved_at TIMESTAMPTZ,
  approval_signature_id UUID,

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (order_id, version_number)
);

-- 2.3 Compounding Order Items
CREATE TABLE compounding_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),
  formula_id UUID NOT NULL REFERENCES compounding_formulas(id),

  inventory_item_id UUID NOT NULL REFERENCES produtos(id),
  item_type item_type NOT NULL,

  theoretical_quantity NUMERIC NOT NULL,
  technical_margin_quantity NUMERIC NOT NULL DEFAULT 0,
  total_required_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,

  actual_consumed_quantity NUMERIC NOT NULL DEFAULT 0,
  returned_quantity NUMERIC NOT NULL DEFAULT 0,
  loss_quantity NUMERIC NOT NULL DEFAULT 0,

  sequence INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 Inventory Lot Reservations
CREATE TABLE inventory_lot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES compounding_orders(id),
  order_item_id UUID NOT NULL REFERENCES compounding_order_items(id),

  inventory_item_id UUID NOT NULL REFERENCES produtos(id),
  inventory_lot_id UUID NOT NULL REFERENCES lotes(id),

  reserved_quantity NUMERIC NOT NULL,
  consumed_quantity NUMERIC NOT NULL DEFAULT 0,
  returned_quantity NUMERIC NOT NULL DEFAULT 0,
  loss_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,

  status reservation_status NOT NULL DEFAULT 'ACTIVE',
  reserved_by UUID NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT
);

-- 2.5 Compounding Separations
CREATE TABLE compounding_separations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),
  reservation_id UUID NOT NULL REFERENCES inventory_lot_reservations(id),

  expected_quantity NUMERIC NOT NULL,
  separated_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,

  separated_by UUID NOT NULL,
  checked_by UUID,
  separated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ,

  status separation_status NOT NULL DEFAULT 'PENDING',
  divergence_reason TEXT
);

-- 2.6 Compounding Weighings
CREATE TABLE compounding_weighings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),
  order_item_id UUID NOT NULL REFERENCES compounding_order_items(id),
  reservation_id UUID NOT NULL REFERENCES inventory_lot_reservations(id),

  sequence INTEGER NOT NULL,
  theoretical_quantity NUMERIC NOT NULL,
  actual_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,

  allowed_minimum NUMERIC,
  allowed_maximum NUMERIC,
  container_tare NUMERIC,
  gross_weight NUMERIC,
  net_weight NUMERIC,

  equipment_id UUID,
  calibration_status TEXT,

  weighed_by UUID NOT NULL,
  verified_by UUID,
  weighed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  status weighing_status NOT NULL DEFAULT 'PENDING',
  notes TEXT
);

-- 2.7 Compounding Steps
CREATE TABLE compounding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),

  sequence INTEGER NOT NULL,
  step_type step_type NOT NULL,
  instruction_version TEXT NOT NULL,
  approved_instruction TEXT NOT NULL,

  status step_status NOT NULL DEFAULT 'PENDING',
  started_by UUID,
  started_at TIMESTAMPTZ,
  completed_by UUID,
  completed_at TIMESTAMPTZ,

  equipment_data JSONB,
  environment_data JSONB,
  measured_values JSONB,
  notes TEXT,

  deviation_detected BOOLEAN NOT NULL DEFAULT FALSE,
  deviation_id UUID,

  UNIQUE (order_id, sequence)
);

-- 2.8 Compounding Quality Checks
CREATE TABLE compounding_quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),

  check_stage TEXT NOT NULL,
  check_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,

  target_value TEXT,
  minimum_value NUMERIC,
  maximum_value NUMERIC,
  unit TEXT,

  result_value TEXT,
  result_status quality_status NOT NULL DEFAULT 'PENDING',

  method_reference TEXT,
  equipment_id UUID,

  performed_by UUID,
  verified_by UUID,
  performed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  notes TEXT,
  attachment_storage_key TEXT
);

-- 2.9 Compounding Deviations
CREATE TABLE compounding_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),

  deviation_type TEXT NOT NULL,
  severity deviation_severity NOT NULL,
  description TEXT NOT NULL,

  detected_by UUID NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  status deviation_status NOT NULL DEFAULT 'OPEN',
  investigation TEXT,
  corrective_action TEXT,
  preventive_action TEXT,

  decided_by UUID,
  decided_at TIMESTAMPTZ,
  final_decision TEXT
);

-- 2.10 Compounding Releases
CREATE TABLE compounding_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES compounding_orders(id),

  pharmacist_id UUID NOT NULL,
  pharmacist_name TEXT NOT NULL,
  crf_number TEXT NOT NULL,
  crf_state TEXT NOT NULL,

  decision release_decision NOT NULL,
  notes TEXT,

  signature_method signature_method NOT NULL,
  signature_status TEXT NOT NULL DEFAULT 'COMPLETED',

  order_hash TEXT NOT NULL,
  production_record_hash TEXT NOT NULL,
  quality_record_hash TEXT NOT NULL,
  release_record_hash TEXT NOT NULL,

  certificate_subject TEXT,
  certificate_issuer TEXT,
  certificate_serial TEXT,

  release_pdf_storage_key TEXT,
  signed_at TIMESTAMPTZ NOT NULL,
  validated_at TIMESTAMPTZ,
  validation_result JSONB,

  ip_address INET,
  user_agent TEXT,
  authentication_session_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 Compounding Status History
CREATE TABLE compounding_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES compounding_orders(id),

  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,

  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  metadata JSONB
);

-- 2.12 Compounding Audit Logs (append-only)
CREATE TABLE compounding_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  order_id UUID,
  user_id UUID,

  event_type TEXT NOT NULL,
  event_reason TEXT,
  entity_type TEXT,
  entity_id UUID,

  previous_data JSONB,
  new_data JSONB,
  metadata JSONB,

  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX idx_compounding_orders_status ON compounding_orders(status);
CREATE INDEX idx_compounding_orders_patient ON compounding_orders(patient_id);
CREATE INDEX idx_compounding_orders_prescription ON compounding_orders(prescription_id);
CREATE INDEX idx_compounding_orders_clinic ON compounding_orders(clinic_id);
CREATE INDEX idx_compounding_orders_internal_number ON compounding_orders(internal_number);
CREATE INDEX idx_compounding_orders_assigned ON compounding_orders(assigned_manipulator_id);
CREATE INDEX idx_compounding_formulas_order ON compounding_formulas(order_id);
CREATE INDEX idx_compounding_order_items_order ON compounding_order_items(order_id);
CREATE INDEX idx_inventory_lot_reservations_order ON inventory_lot_reservations(order_id);
CREATE INDEX idx_inventory_lot_reservations_lot ON inventory_lot_reservations(inventory_lot_id);
CREATE INDEX idx_inventory_lot_reservations_active ON inventory_lot_reservations(status) WHERE status = 'ACTIVE';
CREATE INDEX idx_compounding_separations_order ON compounding_separations(order_id);
CREATE INDEX idx_compounding_weighings_order ON compounding_weighings(order_id);
CREATE INDEX idx_compounding_steps_order ON compounding_steps(order_id);
CREATE INDEX idx_compounding_quality_checks_order ON compounding_quality_checks(order_id);
CREATE INDEX idx_compounding_deviations_order ON compounding_deviations(order_id);
CREATE INDEX idx_compounding_deviations_open ON compounding_deviations(status) WHERE status IN ('OPEN','INVESTIGATION');
CREATE INDEX idx_compounding_releases_order ON compounding_releases(order_id);
CREATE INDEX idx_compounding_status_history_order ON compounding_status_history(order_id);
CREATE INDEX idx_compounding_audit_logs_order ON compounding_audit_logs(order_id);
CREATE INDEX idx_compounding_audit_logs_event ON compounding_audit_logs(event_type);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================
ALTER TABLE compounding_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_separations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_weighings ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE compounding_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- COMPOUNDING ORDERS RLS
CREATE POLICY compounding_orders_select ON compounding_orders
  FOR SELECT USING (
    (current_user_role() IN ('administrador','farmaceutico'))
    OR (current_user_role() = 'manipulador' AND assigned_manipulator_id = auth.uid())
    OR (current_user_role() = 'atendente' AND status IN ('READY_FOR_PICKUP','OUT_FOR_DELIVERY','DISPENSED'))
    OR (current_user_role() = 'financeiro' AND status IN ('READY_FOR_PICKUP','DISPENSED','CANCELLED'))
    OR (current_user_role() = 'estoquista' AND status IN ('CHECKING_STOCK','STOCK_RESERVED','DRAFT','CANCELLED'))
  );

CREATE POLICY compounding_orders_insert ON compounding_orders
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

CREATE POLICY compounding_orders_update ON compounding_orders
  FOR UPDATE USING (
    current_user_role() IN ('administrador','farmaceutico')
    OR (current_user_role() = 'manipulador' AND assigned_manipulator_id = auth.uid()
        AND status IN ('IN_SEPARATION','AWAITING_WEIGHING','IN_WEIGHING','IN_COMPOUNDING',
                       'IN_PROCESS_CONTROL','AWAITING_PACKAGING','IN_PACKAGING',
                       'AWAITING_LABELING','IN_LABELING','PRODUCTION_COMPLETED'))
  );

-- FORMULAS RLS
CREATE POLICY compounding_formulas_select ON compounding_formulas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM compounding_orders WHERE id = order_id)
    AND current_user_role() IN ('administrador','farmaceutico','manipulador')
  );

CREATE POLICY compounding_formulas_insert ON compounding_formulas
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

-- ORDER ITEMS RLS
CREATE POLICY compounding_order_items_select ON compounding_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM compounding_orders WHERE id = order_id)
    AND current_user_role() IN ('administrador','farmaceutico','manipulador','estoquista')
  );

-- INVENTORY LOT RESERVATIONS RLS
CREATE POLICY inventory_lot_reservations_select ON inventory_lot_reservations
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador','estoquista'));

CREATE POLICY inventory_lot_reservations_insert ON inventory_lot_reservations
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

CREATE POLICY inventory_lot_reservations_update ON inventory_lot_reservations
  FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- SEPARATIONS RLS
CREATE POLICY compounding_separations_select ON compounding_separations
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_separations_insert ON compounding_separations
  FOR INSERT WITH CHECK (current_user_role() IN ('manipulador','farmaceutico','administrador'));

CREATE POLICY compounding_separations_update ON compounding_separations
  FOR UPDATE USING (current_user_role() IN ('manipulador','farmaceutico','administrador'));

-- WEIGHINGS RLS
CREATE POLICY compounding_weighings_select ON compounding_weighings
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_weighings_insert ON compounding_weighings
  FOR INSERT WITH CHECK (current_user_role() IN ('manipulador','farmaceutico','administrador'));

CREATE POLICY compounding_weighings_update ON compounding_weighings
  FOR UPDATE USING (current_user_role() IN ('manipulador','farmaceutico','administrador'));

-- STEPS RLS
CREATE POLICY compounding_steps_select ON compounding_steps
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_steps_insert ON compounding_steps
  FOR INSERT WITH CHECK (current_user_role() IN ('manipulador','farmaceutico','administrador'));

CREATE POLICY compounding_steps_update ON compounding_steps
  FOR UPDATE USING (
    current_user_role() IN ('administrador','farmaceutico')
    OR (current_user_role() = 'manipulador' AND status IN ('PENDING','IN_PROGRESS','PAUSED'))
  );

-- QUALITY CHECKS RLS
CREATE POLICY compounding_quality_checks_select ON compounding_quality_checks
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_quality_checks_insert ON compounding_quality_checks
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_quality_checks_update ON compounding_quality_checks
  FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- DEVIATIONS RLS
CREATE POLICY compounding_deviations_select ON compounding_deviations
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_deviations_insert ON compounding_deviations
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_deviations_update ON compounding_deviations
  FOR UPDATE USING (current_user_role() IN ('administrador','farmaceutico'));

-- RELEASES RLS
CREATE POLICY compounding_releases_select ON compounding_releases
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico'));

CREATE POLICY compounding_releases_insert ON compounding_releases
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico'));

-- STATUS HISTORY RLS
CREATE POLICY compounding_status_history_select ON compounding_status_history
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico','manipulador'));

CREATE POLICY compounding_status_history_insert ON compounding_status_history
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','manipulador'));

-- AUDIT LOGS RLS (append-only: SELECT + INSERT only)
CREATE POLICY compounding_audit_logs_select ON compounding_audit_logs
  FOR SELECT USING (current_user_role() IN ('administrador','farmaceutico'));

CREATE POLICY compounding_audit_logs_insert ON compounding_audit_logs
  FOR INSERT WITH CHECK (current_user_role() IN ('administrador','farmaceutico','manipulador'));

REVOKE UPDATE, DELETE ON compounding_audit_logs FROM authenticated, anon, public;

-- ============================================================
-- 5. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('production-records', 'production-records', FALSE, 52428800, ARRAY['application/pdf']),
  ('quality-control', 'quality-control', FALSE, 52428800, ARRAY['application/pdf','image/jpeg','image/png']),
  ('release-documents', 'release-documents', FALSE, 52428800, ARRAY['application/pdf']),
  ('labels', 'labels', FALSE, 52428800, ARRAY['application/pdf','image/png']),
  ('attachments', 'attachments', FALSE, 104857600, ARRAY['application/pdf','image/jpeg','image/png','image/tiff'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY storage_compounding_select ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('production-records','quality-control','release-documents','labels','attachments')
    AND auth.role() = 'authenticated'
    AND current_user_role() IN ('administrador','farmaceutico','manipulador')
  );

CREATE POLICY storage_compounding_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('production-records','quality-control','release-documents','labels','attachments')
    AND auth.role() = 'authenticated'
    AND current_user_role() IN ('administrador','farmaceutico','manipulador')
  );

-- ============================================================
-- 6. TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_compounding_orders_updated_at()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compounding_orders_updated_at
  BEFORE UPDATE ON compounding_orders
  FOR EACH ROW EXECUTE FUNCTION update_compounding_orders_updated_at();
