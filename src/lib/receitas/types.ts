export type DocumentOrigin = 'NATIVE_DIGITAL' | 'PHYSICAL_SCANNED' | 'EXTERNAL_DIGITAL'

export type PrescriptionStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_UPLOAD'
  | 'AGUARDANDO_CONFERENCIA'
  | 'EM_CONFERENCIA'
  | 'PENDENCIA_DOCUMENTAL'
  | 'REJEITADA'
  | 'APROVADA'
  | 'ARQUIVADA'
  | 'SUBSTITUIDA'
  | 'CANCELADA'
  | 'VENCIDA'
  | 'EM_RETENCAO_LEGAL'
  | 'AGUARDANDO_DESCARTE'
  | 'DESCARTADA'

export type SignatureMethod = 'ADVANCED_ELECTRONIC_SIGNATURE' | 'ICP_BRASIL_QUALIFIED_SIGNATURE'
export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'DOCUMENTAL_ISSUE' | 'SAVED'
export type AuditEventType =
  | 'PRESCRIPTION_CREATED' | 'FILE_UPLOADED' | 'FILE_VIEWED' | 'FILE_DOWNLOADED'
  | 'FILE_PRINTED' | 'VERSION_CREATED' | 'REVIEW_STARTED' | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED' | 'DOCUMENTAL_ISSUE_REPORTED' | 'PHARMACIST_SIGNATURE_STARTED'
  | 'PHARMACIST_SIGNATURE_COMPLETED' | 'PHARMACIST_SIGNATURE_FAILED'
  | 'SIGNATURE_VALIDATED' | 'PRESCRIPTION_ARCHIVED' | 'PRESCRIPTION_REPLACED'
  | 'PRESCRIPTION_CANCELLED' | 'LEGAL_HOLD_ACTIVATED' | 'LEGAL_HOLD_REMOVED'
  | 'DISCARD_REQUESTED' | 'DISCARD_APPROVED' | 'DOCUMENT_DISCARDED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'

export interface Prescription {
  id: string
  clinic_id: string
  patient_id: string
  prescriber_name: string
  prescriber_registration: string | null
  prescriber_registration_state: string | null
  prescription_type: string
  document_origin: DocumentOrigin
  issued_at: string | null
  expires_at: string | null
  status: PrescriptionStatus
  current_version_id: string | null
  physical_original_required: boolean
  physical_original_received: boolean
  physical_original_location: string | null
  external_platform: string | null
  external_id: string | null
  external_validation_link: string | null
  external_validation_result: string | null
  external_validated_at: string | null
  external_validated_by: string | null
  clinical_retention_until: string | null
  legal_hold: boolean
  legal_hold_reason: string | null
  created_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
  discarded_at: string | null
}

export interface PrescriptionVersion {
  id: string
  prescription_id: string
  version_number: number
  storage_object_key: string
  original_filename: string | null
  mime_type: string
  file_size: number
  file_hash_sha256: string
  uploaded_by: string
  upload_reason: string | null
  is_current: boolean
  created_at: string
}

export interface PharmacistReview {
  id: string
  prescription_id: string
  prescription_version_id: string
  pharmacist_id: string
  pharmacist_name: string
  crf_number: string
  crf_state: string
  document_legible: boolean
  patient_verified: boolean
  prescriber_verified: boolean
  prescriber_registration_verified: boolean
  prescriber_signature_verified: boolean
  issue_date_verified: boolean
  document_complete: boolean
  document_origin_verified: boolean
  file_patient_match: boolean
  no_visible_tampering: boolean
  physical_location_verified: boolean | null
  final_checklist_confirmed: boolean
  decision: ReviewDecision
  notes: string | null
  reviewed_at: string
}

export interface PharmacistSignature {
  id: string
  prescription_id: string
  review_id: string
  pharmacist_id: string
  signature_method: SignatureMethod
  signature_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'VALIDATED'
  certificate_subject: string | null
  certificate_issuer: string | null
  certificate_serial: string | null
  prescription_file_hash: string
  acceptance_term_hash: string
  acceptance_term_storage_key: string
  signed_at: string
  validated_at: string | null
  validation_provider: string | null
  validation_result: unknown | null
  ip_address: string | null
  user_agent: string | null
  authentication_session_id: string | null
  created_at: string
}

export interface PrescriptionAuditLog {
  id: string
  clinic_id: string
  prescription_id: string
  prescription_version_id: string | null
  user_id: string | null
  event_type: AuditEventType
  event_reason: string | null
  previous_status: string | null
  new_status: string | null
  metadata: unknown | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface ChecklistItem {
  key: string
  label: string
  value: boolean
}

export const CHECKLIST_ITEMS: Omit<ChecklistItem, 'value'>[] = [
  { key: 'document_legible', label: 'Documento legível' },
  { key: 'patient_verified', label: 'Paciente corretamente identificado' },
  { key: 'prescriber_verified', label: 'Prescritor corretamente identificado' },
  { key: 'prescriber_registration_verified', label: 'Registro profissional do prescritor informado' },
  { key: 'prescriber_signature_verified', label: 'Assinatura do prescritor identificada' },
  { key: 'issue_date_verified', label: 'Data de emissão identificada' },
  { key: 'document_complete', label: 'Documento completo, sem páginas faltando' },
  { key: 'document_origin_verified', label: 'Origem do documento corretamente classificada' },
  { key: 'file_patient_match', label: 'Arquivo corresponde ao paciente selecionado' },
  { key: 'no_visible_tampering', label: 'Ausência de sinais visíveis de alteração' },
  { key: 'physical_location_verified', label: 'Localização do original físico registrada, quando aplicável' },
  { key: 'final_checklist_confirmed', label: 'Conferência final concluída' },
]

export const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_UPLOAD: 'Aguardando upload',
  AGUARDANDO_CONFERENCIA: 'Pendente de conferência',
  EM_CONFERENCIA: 'Em conferência',
  PENDENCIA_DOCUMENTAL: 'Com pendência',
  REJEITADA: 'Rejeitada',
  APROVADA: 'Aprovada',
  ARQUIVADA: 'Arquivada',
  SUBSTITUIDA: 'Substituída',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
  EM_RETENCAO_LEGAL: 'Retenção legal',
  AGUARDANDO_DESCARTE: 'Aguardando descarte',
  DESCARTADA: 'Descartada',
}

export const STATUS_COLORS: Record<PrescriptionStatus, string> = {
  RASCUNHO: 'text-muted-foreground',
  AGUARDANDO_UPLOAD: 'text-muted-foreground',
  AGUARDANDO_CONFERENCIA: 'text-amber-500',
  EM_CONFERENCIA: 'text-blue-500',
  PENDENCIA_DOCUMENTAL: 'text-orange-500',
  REJEITADA: 'text-destructive',
  APROVADA: 'text-emerald-500',
  ARQUIVADA: 'text-emerald-600',
  SUBSTITUIDA: 'text-violet-500',
  CANCELADA: 'text-destructive/60',
  VENCIDA: 'text-muted-foreground/50',
  EM_RETENCAO_LEGAL: 'text-red-600',
  AGUARDANDO_DESCARTE: 'text-muted-foreground',
  DESCARTADA: 'text-muted-foreground/40',
}

export const DOCUMENT_ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  NATIVE_DIGITAL: 'Receita digital nativa',
  PHYSICAL_SCANNED: 'Receita física digitalizada',
  EXTERNAL_DIGITAL: 'Receita digital externa',
}

export const STATUS_GROUPS: Record<string, PrescriptionStatus[]> = {
  pendentes: ['AGUARDANDO_CONFERENCIA'],
  em_conferencia: ['EM_CONFERENCIA'],
  com_pendencia: ['PENDENCIA_DOCUMENTAL'],
  aprovadas: ['APROVADA'],
  arquivadas: ['ARQUIVADA'],
  rejeitadas: ['REJEITADA'],
  substituidas: ['SUBSTITUIDA'],
  canceladas: ['CANCELADA'],
  retencao_legal: ['EM_RETENCAO_LEGAL'],
}
