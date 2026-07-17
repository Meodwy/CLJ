-- ============================================================
-- CLJ Clínica — Aplicar Migration 004_guarda_receitas
-- COPIAR E COLAR no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/gqkyjfrbgodcjiciwmbz/sql/new
-- ============================================================

-- 1. PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  prescriber_name TEXT NOT NULL,
  prescriber_registration TEXT,
  prescriber_registration_state TEXT,
  prescription_type TEXT NOT NULL,
  document_origin TEXT NOT NULL CHECK (document_origin IN ('NATIVE_DIGITAL','PHYSICAL_SCANNED','EXTERNAL_DIGITAL')),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN (
    'RASCUNHO','AGUARDANDO_UPLOAD','AGUARDANDO_CONFERENCIA','EM_CONFERENCIA',
    'PENDENCIA_DOCUMENTAL','REJEITADA','APROVADA','ARQUIVADA','SUBSTITUIDA',
    'CANCELADA','VENCIDA','EM_RETENCAO_LEGAL','AGUARDANDO_DESCARTE','DESCARTADA'
  )),
  current_version_id UUID,
  physical_original_required BOOLEAN NOT NULL DEFAULT FALSE,
  physical_original_received BOOLEAN NOT NULL DEFAULT FALSE,
  physical_original_location TEXT,
  external_platform TEXT,
  external_id TEXT,
  external_validation_link TEXT,
  external_validation_result TEXT,
  external_validated_at TIMESTAMPTZ,
  external_validated_by UUID,
  clinical_retention_until TIMESTAMPTZ,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  legal_hold_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ
);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- 2. PRESCRIPTION VERSIONS
CREATE TABLE IF NOT EXISTS prescription_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_object_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_hash_sha256 TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  upload_reason TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prescription_id, version_number),
  UNIQUE (file_hash_sha256)
);
ALTER TABLE prescription_versions ENABLE ROW LEVEL SECURITY;

-- 3. PHARMACIST REVIEWS
CREATE TABLE IF NOT EXISTS pharmacist_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  prescription_version_id UUID NOT NULL REFERENCES prescription_versions(id) ON DELETE CASCADE,
  pharmacist_id UUID NOT NULL,
  pharmacist_name TEXT NOT NULL,
  crf_number TEXT NOT NULL,
  crf_state TEXT NOT NULL,
  document_legible BOOLEAN NOT NULL,
  patient_verified BOOLEAN NOT NULL,
  prescriber_verified BOOLEAN NOT NULL,
  prescriber_registration_verified BOOLEAN NOT NULL DEFAULT FALSE,
  prescriber_signature_verified BOOLEAN NOT NULL,
  issue_date_verified BOOLEAN NOT NULL,
  document_complete BOOLEAN NOT NULL,
  document_origin_verified BOOLEAN NOT NULL,
  file_patient_match BOOLEAN NOT NULL,
  no_visible_tampering BOOLEAN NOT NULL,
  physical_location_verified BOOLEAN,
  final_checklist_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED','DOCUMENTAL_ISSUE')),
  notes TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE pharmacist_reviews ENABLE ROW LEVEL SECURITY;

-- 4. PHARMACIST SIGNATURES
CREATE TABLE IF NOT EXISTS pharmacist_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES pharmacist_reviews(id) ON DELETE CASCADE,
  pharmacist_id UUID NOT NULL,
  signature_method TEXT NOT NULL CHECK (signature_method IN ('ADVANCED_ELECTRONIC_SIGNATURE','ICP_BRASIL_QUALIFIED_SIGNATURE')),
  signature_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (signature_status IN ('PENDING','COMPLETED','FAILED','VALIDATED')),
  certificate_subject TEXT,
  certificate_issuer TEXT,
  certificate_serial TEXT,
  prescription_file_hash TEXT NOT NULL,
  acceptance_term_hash TEXT NOT NULL,
  acceptance_term_storage_key TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  validated_at TIMESTAMPTZ,
  validation_provider TEXT,
  validation_result JSONB,
  ip_address INET,
  user_agent TEXT,
  authentication_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE pharmacist_signatures ENABLE ROW LEVEL SECURITY;

-- 5. PRESCRIPTION AUDIT LOGS (append-only)
CREATE TABLE IF NOT EXISTS prescription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  prescription_version_id UUID,
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PRESCRIPTION_CREATED','FILE_UPLOADED','FILE_VIEWED','FILE_DOWNLOADED',
    'FILE_PRINTED','VERSION_CREATED','REVIEW_STARTED','REVIEW_APPROVED',
    'REVIEW_REJECTED','DOCUMENTAL_ISSUE_REPORTED','PHARMACIST_SIGNATURE_STARTED',
    'PHARMACIST_SIGNATURE_COMPLETED','PHARMACIST_SIGNATURE_FAILED',
    'SIGNATURE_VALIDATED','PRESCRIPTION_ARCHIVED','PRESCRIPTION_REPLACED',
    'PRESCRIPTION_CANCELLED','LEGAL_HOLD_ACTIVATED','LEGAL_HOLD_REMOVED',
    'DISCARD_REQUESTED','DISCARD_APPROVED','DOCUMENT_DISCARDED',
    'UNAUTHORIZED_ACCESS_ATTEMPT'
  )),
  event_reason TEXT,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE prescription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_legal_hold ON prescriptions(legal_hold) WHERE legal_hold = TRUE;
CREATE INDEX IF NOT EXISTS idx_prescription_versions_prescription ON prescription_versions(prescription_id);
CREATE INDEX IF NOT EXISTS idx_pharmacist_reviews_prescription ON pharmacist_reviews(prescription_id);
CREATE INDEX IF NOT EXISTS idx_pharmacist_signatures_prescription ON pharmacist_signatures(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_audit_logs_prescription ON prescription_audit_logs(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_audit_logs_event ON prescription_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_prescription_audit_logs_created ON prescription_audit_logs(created_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper functions (safe: CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.user_belongs_to_clinic(clinic_id UUID)
RETURNS BOOLEAN
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- PRESCRIPTIONS RLS
CREATE POLICY prescriptions_select_own_clinic ON prescriptions
  FOR SELECT USING (user_belongs_to_clinic(clinic_id));

CREATE POLICY prescriptions_insert_authorized ON prescriptions
  FOR INSERT WITH CHECK (
    user_belongs_to_clinic(clinic_id)
    AND current_user_role() IN ('administrador','farmaceutico','atendente')
  );

CREATE POLICY prescriptions_update_authorized ON prescriptions
  FOR UPDATE USING (
    user_belongs_to_clinic(clinic_id)
    AND (
      current_user_role() IN ('administrador','farmaceutico')
      OR (current_user_role() = 'atendente' AND status IN ('RASCUNHO','AGUARDANDO_UPLOAD'))
    )
  );

CREATE POLICY prescriptions_update_pharmacist ON prescriptions
  FOR UPDATE USING (
    user_belongs_to_clinic(clinic_id)
    AND current_user_role() = 'farmaceutico'
    AND status IN ('AGUARDANDO_CONFERENCIA','EM_CONFERENCIA','PENDENCIA_DOCUMENTAL')
  );

-- PRESCRIPTION VERSIONS RLS
CREATE POLICY versions_select_authorized ON prescription_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
      AND (
        current_user_role() IN ('administrador','farmaceutico')
        OR (current_user_role() = 'atendente' AND p.status IN ('RASCUNHO','AGUARDANDO_UPLOAD'))
      )
    )
  );

CREATE POLICY versions_insert_authorized ON prescription_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
      AND current_user_role() IN ('administrador','farmaceutico','atendente')
      AND p.status NOT IN ('ARQUIVADA','CANCELADA','DESCARTADA')
    )
  );

-- PHARMACIST REVIEWS RLS
CREATE POLICY reviews_select_authorized ON pharmacist_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
      AND current_user_role() IN ('administrador','farmaceutico')
    )
  );

CREATE POLICY reviews_insert_pharmacist ON pharmacist_reviews
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
    )
    AND current_user_role() = 'farmaceutico'
    AND pharmacist_id = auth.uid()
  );

-- PHARMACIST SIGNATURES RLS
CREATE POLICY signatures_select_authorized ON pharmacist_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
      AND current_user_role() IN ('administrador','farmaceutico')
    )
  );

CREATE POLICY signatures_insert_pharmacist ON pharmacist_signatures
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prescriptions p
      WHERE p.id = prescription_id
      AND user_belongs_to_clinic(p.clinic_id)
    )
    AND current_user_role() = 'farmaceutico'
    AND pharmacist_id = auth.uid()
  );

-- AUDIT LOGS RLS (append-only)
CREATE POLICY audit_logs_select ON prescription_audit_logs
  FOR SELECT USING (
    user_belongs_to_clinic(clinic_id)
    AND current_user_role() IN ('administrador','farmaceutico')
  );

CREATE POLICY audit_logs_insert ON prescription_audit_logs
  FOR INSERT WITH CHECK (user_belongs_to_clinic(clinic_id));

-- Explicitly deny UPDATE/DELETE on audit logs
REVOKE UPDATE, DELETE ON prescription_audit_logs FROM authenticated, anon, public;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Archive prescription (only after pharmacist signature)
CREATE OR REPLACE FUNCTION public.archive_prescription(p_prescription_id UUID)
RETURNS BOOLEAN
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_current_status TEXT;
  v_has_signature BOOLEAN;
BEGIN
  SELECT status INTO v_current_status FROM prescriptions WHERE id = p_prescription_id;
  IF v_current_status != 'APROVADA' THEN
    RAISE EXCEPTION 'Prescription must be APROVADA before archiving';
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM pharmacist_signatures WHERE prescription_id = p_prescription_id
  ) INTO v_has_signature;
  IF NOT v_has_signature THEN
    RAISE EXCEPTION 'Prescription must have a pharmacist signature before archiving';
  END IF;
  UPDATE prescriptions SET
    status = 'ARQUIVADA', archived_at = NOW(), updated_at = NOW()
  WHERE id = p_prescription_id;
  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_prescription FROM anon, public;
GRANT EXECUTE ON FUNCTION public.archive_prescription TO authenticated;

-- Log audit event
CREATE OR REPLACE FUNCTION public.log_prescription_audit(
  p_clinic_id UUID, p_prescription_id UUID, p_event_type TEXT,
  p_user_id UUID DEFAULT NULL, p_previous_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL, p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO prescription_audit_logs (
    clinic_id, prescription_id, event_type, user_id,
    previous_status, new_status, metadata, ip_address
  ) VALUES (
    p_clinic_id, p_prescription_id, p_event_type,
    COALESCE(p_user_id, auth.uid()),
    p_previous_status, p_new_status, p_metadata, inet_client_addr()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_prescription_audit FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_prescription_audit TO authenticated;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-prescriptions', 'medical-prescriptions', FALSE,
  52428800, ARRAY['application/pdf','image/jpeg','image/png','image/tiff']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY storage_prescriptions_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-prescriptions'
    AND auth.role() = 'authenticated'
    AND (current_user_role() IN ('administrador','farmaceutico')
      OR (current_user_role() = 'atendente' AND (storage.foldername(name))[1] = 'clinics'))
  );

CREATE POLICY storage_prescriptions_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medical-prescriptions'
    AND auth.role() = 'authenticated'
    AND current_user_role() IN ('administrador','farmaceutico','atendente')
  );

CREATE POLICY storage_prescriptions_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'medical-prescriptions'
    AND auth.role() = 'authenticated'
    AND current_user_role() IN ('administrador','farmaceutico')
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_prescriptions_updated_at()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_prescriptions_updated_at();
