import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'
import type {
  Prescription, PrescriptionVersion, PharmacistReview, PharmacistSignature,
  PrescriptionAuditLog, DocumentOrigin, PrescriptionStatus, ReviewDecision, SignatureMethod,
} from './types'

const BUCKET = 'medical-prescriptions'

/** Retry a Supabase query on connection timeout */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      const isTimeout = err?.message?.includes('ConnectTimeoutError') || err?.message?.includes('timeout')
      if (isTimeout && i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Unexpected retry exit')
}

function storagePath(clinicId: string, patientId: string, prescriptionId: string, versionId: string, filename: string) {
  return `clinics/${clinicId}/patients/${patientId}/prescriptions/${prescriptionId}/versions/${versionId}/${filename}`
}

function termPath(clinicId: string, patientId: string, prescriptionId: string, signatureId: string) {
  return `clinics/${clinicId}/patients/${patientId}/prescriptions/${prescriptionId}/acceptance-terms/${signatureId}/termo-conferencia.pdf`
}

export async function createPrescription(data: {
  clinic_id: string
  patient_id: string
  prescriber_name: string
  prescriber_registration?: string
  prescriber_registration_state?: string
  prescription_type: string
  document_origin: DocumentOrigin
  issued_at?: string
  expires_at?: string
  physical_original_required?: boolean
  external_platform?: string
  external_id?: string
  external_validation_link?: string
  clinical_retention_until?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert({
      ...data,
      status: 'RASCUNHO',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error

  await logAudit({
    clinic_id: data.clinic_id,
    prescription_id: prescription.id,
    event_type: 'PRESCRIPTION_CREATED',
    new_status: 'RASCUNHO',
  })

  return prescription as Prescription
}

export async function uploadPrescriptionFile(
  prescriptionId: string,
  file: File,
  uploadReason?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get prescription
  const { data: prescription } = await supabase
    .from('prescriptions')
    .select('*, clinic_id, patient_id, status')
    .eq('id', prescriptionId)
    .single()

  if (!prescription) throw new Error('Prescription not found')
  if (['ARQUIVADA', 'CANCELADA', 'DESCARTADA'].includes(prescription.status)) {
    throw new Error('Cannot upload to archived/cancelled/discarded prescription')
  }

  // Get current version number
  const { data: versions } = await supabase
    .from('prescription_versions')
    .select('version_number')
    .eq('prescription_id', prescriptionId)
    .order('version_number', { ascending: false })
    .limit(1)

  const versionNumber = (versions?.[0]?.version_number ?? 0) + 1

  // Calculate SHA-256 hash
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  // Check duplicate hash
  const { data: existingHash } = await supabase
    .from('prescription_versions')
    .select('id')
    .eq('file_hash_sha256', fileHash)
    .single()

  if (existingHash) {
    // Check if it's the same prescription (same content, same patient)
    const { data: dupVersion } = await supabase
      .from('prescription_versions')
      .select('prescription_id, storage_object_key')
      .eq('file_hash_sha256', fileHash)
      .single()

    if (dupVersion && dupVersion.prescription_id !== prescriptionId) {
      throw new Error('File already exists in another prescription')
    }
  }

  // Upload to Storage
  const versionId = crypto.randomUUID()
  const objectKey = storagePath(
    prescription.clinic_id,
    prescription.patient_id,
    prescriptionId,
    versionId,
    file.name
  )

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectKey, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  // Mark previous versions as not current
  if (versionNumber > 1) {
    await supabase
      .from('prescription_versions')
      .update({ is_current: false })
      .eq('prescription_id', prescriptionId)
  }

  // Create version record
  const { data: version, error: versionError } = await supabase
    .from('prescription_versions')
    .insert({
      id: versionId,
      prescription_id: prescriptionId,
      version_number: versionNumber,
      storage_object_key: objectKey,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      file_hash_sha256: fileHash,
      uploaded_by: user.id,
      upload_reason: uploadReason ?? null,
      is_current: true,
    })
    .select()
    .single()

  if (versionError) {
    // Rollback storage
    await supabase.storage.from(BUCKET).remove([objectKey])
    throw versionError
  }

  // Update prescription with current version and status
  const newStatus: PrescriptionStatus = prescription.status === 'RASCUNHO' ? 'AGUARDANDO_CONFERENCIA' : prescription.status
  await supabase
    .from('prescriptions')
    .update({
      current_version_id: versionId,
      status: newStatus,
    })
    .eq('id', prescriptionId)

  await logAudit({
    clinic_id: prescription.clinic_id,
    prescription_id: prescriptionId,
    prescription_version_id: versionId,
    event_type: 'FILE_UPLOADED',
    new_status: newStatus,
  })

  return version as PrescriptionVersion
}

export async function listPrescriptions(
  statusFilter?: PrescriptionStatus | PrescriptionStatus[],
  patientId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('prescriptions')
    .select(`
      *,
      patient:pacientes!patient_id(nome),
      current_version:prescription_versions!current_version_id(storage_object_key, mime_type, file_size, original_filename),
      latest_review:pharmacist_reviews(pharmacist_name, decision, reviewed_at)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter) {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
    query = query.in('status', statuses)
  }

  if (patientId) {
    query = query.eq('patient_id', patientId)
  }

  const { data, error } = await query

  if (error) throw error
  return data as (Prescription & {
    patient: { nome: string } | null
    current_version: Pick<PrescriptionVersion, 'storage_object_key' | 'mime_type' | 'file_size' | 'original_filename'> | null
    latest_review: Pick<PharmacistReview, 'pharmacist_name' | 'decision' | 'reviewed_at'> | null
  })[]
}

export async function getPrescription(id: string) {
  const admin = createServiceClient()

  // Fetch prescription with relations (no FK-dependent join)
  const { data: prescription, error } = await admin
    .from('prescriptions')
    .select(`
      *,
      versions:prescription_versions(*),
      reviews:pharmacist_reviews(*),
      signatures:pharmacist_signatures(*),
      audit_logs:prescription_audit_logs(*)
    `)
    .eq('id', id)
    .order('created_at', { foreignTable: 'prescription_versions', ascending: false })
    .order('created_at', { foreignTable: 'prescription_audit_logs', ascending: false })
    .single()

  if (error) throw error

  // Fetch patient separately via admin client (no FK constraint, bypass RLS)
  let patient: { id: string; nome: string; cpf: string | null } | null = null
  if (prescription.patient_id) {
    const { data: p } = await admin
      .from('pacientes')
      .select('id, nome, cpf')
      .eq('id', prescription.patient_id)
      .single()
    patient = p
  }

  return { ...prescription, patient } as Prescription & {
    patient: { id: string; nome: string; cpf: string | null } | null
    versions: PrescriptionVersion[]
    reviews: PharmacistReview[]
    signatures: PharmacistSignature[]
    audit_logs: PrescriptionAuditLog[]
  }
}

export async function getFileUrl(storageObjectKey: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageObjectKey, 300) // 5 min expiry

  if (error) throw error
  return data.signedUrl
}

export async function startReview(prescriptionId: string) {
  const admin = createServiceClient()

  const { data: prescription } = await admin
    .from('prescriptions')
    .select('clinic_id, status')
    .eq('id', prescriptionId)
    .single()

  if (!prescription) throw new Error('Prescription not found')
  if (prescription.status !== 'AGUARDANDO_CONFERENCIA') {
    throw new Error('Prescription must be AGUARDANDO_CONFERENCIA')
  }

  await admin
    .from('prescriptions')
    .update({ status: 'EM_CONFERENCIA' })
    .eq('id', prescriptionId)

  await logAudit({
    clinic_id: prescription.clinic_id,
    prescription_id: prescriptionId,
    event_type: 'REVIEW_STARTED',
    previous_status: 'AGUARDANDO_CONFERENCIA',
    new_status: 'EM_CONFERENCIA',
  })

  return true
}

export async function submitReview(data: {
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
  physical_location_verified?: boolean
  final_checklist_confirmed: boolean
  decision: ReviewDecision
  notes?: string
}) {
  return withRetry(async () => {
    const admin = createServiceClient()

    // Validate checklist is complete for approval
    if (data.decision === 'APPROVED' && !data.final_checklist_confirmed) {
      throw new Error('Checklist must be fully confirmed before approval')
    }

    // All items must be true for APPROVED
    if (data.decision === 'APPROVED') {
      const required = [
        data.document_legible, data.patient_verified, data.prescriber_verified,
        data.prescriber_registration_verified, data.prescriber_signature_verified,
        data.issue_date_verified, data.document_complete, data.document_origin_verified,
        data.file_patient_match, data.no_visible_tampering,
      ]
      if (!required.every(Boolean)) {
        throw new Error('All checklist items must be confirmed for approval')
      }
    }

    const { data: review, error } = await admin
      .from('pharmacist_reviews')
      .insert({ ...data })
      .select()
      .single()

    if (error) throw error

    const { data: prescription } = await admin
      .from('prescriptions')
      .select('clinic_id')
      .eq('id', data.prescription_id)
      .single()

    const eventType = data.decision === 'SAVED'
      ? 'REVIEW_STARTED'
      : data.decision === 'APPROVED'
        ? 'REVIEW_APPROVED'
        : data.decision === 'REJECTED'
          ? 'REVIEW_REJECTED'
          : 'DOCUMENTAL_ISSUE_REPORTED'

    const newStatus = data.decision === 'APPROVED'
      ? 'APROVADA'
      : data.decision === 'REJECTED'
        ? 'REJEITADA'
        : data.decision === 'DOCUMENTAL_ISSUE'
          ? 'PENDENCIA_DOCUMENTAL'
          : null

    if (data.decision !== 'SAVED') {
      await admin
        .from('prescriptions')
        .update({ status: newStatus })
        .eq('id', data.prescription_id)
    }

    await logAudit({
      clinic_id: prescription?.clinic_id ?? '',
      prescription_id: data.prescription_id,
      prescription_version_id: data.prescription_version_id,
      event_type: eventType,
      previous_status: 'EM_CONFERENCIA',
      ...(newStatus ? { new_status: newStatus } : {}),
      metadata: { decision: data.decision, notes: data.notes },
    })

    return review as PharmacistReview
  })
}

export async function signPrescription(data: {
  prescription_id: string
  review_id: string
  signature_method: SignatureMethod
  certificate_subject?: string
  certificate_issuer?: string
  certificate_serial?: string
  prescription_file_hash: string
  acceptance_term_hash: string
  acceptance_term_storage_key: string
  authentication_session_id?: string
  ip_address?: string
  user_agent?: string
}) {
  const supabase = await createClient()
  const supabaseAdmin = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get pharmacist profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')

  await logAudit({
    clinic_id: '',
    prescription_id: data.prescription_id,
    event_type: 'PHARMACIST_SIGNATURE_STARTED',
  })

  const signature: Omit<PharmacistSignature, 'id' | 'created_at'> = {
    prescription_id: data.prescription_id,
    review_id: data.review_id,
    pharmacist_id: user.id,
    signature_method: data.signature_method,
    signature_status: 'COMPLETED',
    certificate_subject: data.certificate_subject ?? null,
    certificate_issuer: data.certificate_issuer ?? null,
    certificate_serial: data.certificate_serial ?? null,
    prescription_file_hash: data.prescription_file_hash,
    acceptance_term_hash: data.acceptance_term_hash,
    acceptance_term_storage_key: data.acceptance_term_storage_key,
    signed_at: new Date().toISOString(),
    validated_at: null,
    validation_provider: null,
    validation_result: null,
    ip_address: data.ip_address ?? null,
    user_agent: data.user_agent ?? null,
    authentication_session_id: data.authentication_session_id ?? null,
  }

  const { data: signatureResult, error } = await supabaseAdmin
    .from('pharmacist_signatures')
    .insert(signature)
    .select()
    .single()

  if (error) {
    await logAudit({
      clinic_id: '',
      prescription_id: data.prescription_id,
      event_type: 'PHARMACIST_SIGNATURE_FAILED',
      metadata: { error: error.message },
    })
    throw error
  }

  await logAudit({
    clinic_id: '',
    prescription_id: data.prescription_id,
    event_type: 'PHARMACIST_SIGNATURE_COMPLETED',
    metadata: { signature_id: signatureResult.id, signature_method: data.signature_method },
  })

  return signatureResult as PharmacistSignature
}

export async function archivePrescription(prescriptionId: string) {
  const admin = createServiceClient()

  const { data: prescription } = await admin
    .from('prescriptions')
    .select('clinic_id, status')
    .eq('id', prescriptionId)
    .single()

  if (!prescription) throw new Error('Prescription not found')
  if (prescription.status !== 'APROVADA') {
    throw new Error('Prescription must be APROVADA before archiving')
  }

  // Check signature exists
  const { data: signatures } = await admin
    .from('pharmacist_signatures')
    .select('id')
    .eq('prescription_id', prescriptionId)

  if (!signatures?.length) {
    throw new Error('Prescription must have a pharmacist signature before archiving')
  }

  await admin
    .from('prescriptions')
    .update({
      status: 'ARQUIVADA',
      archived_at: new Date().toISOString(),
    })
    .eq('id', prescriptionId)

  await logAudit({
    clinic_id: prescription.clinic_id,
    prescription_id: prescriptionId,
    event_type: 'PRESCRIPTION_ARCHIVED',
    previous_status: 'APROVADA',
    new_status: 'ARQUIVADA',
  })

  return true
}

export async function cancelPrescription(prescriptionId: string, reason: string) {
  const admin = createServiceClient()

  const { data: prescription } = await admin
    .from('prescriptions')
    .select('clinic_id, status')
    .eq('id', prescriptionId)
    .single()

  if (!prescription) throw new Error('Prescription not found')
  if (['ARQUIVADA', 'CANCELADA', 'DESCARTADA'].includes(prescription.status)) {
    throw new Error('Cannot cancel archived/cancelled/discarded prescription')
  }

  await admin
    .from('prescriptions')
    .update({ status: 'CANCELADA' })
    .eq('id', prescriptionId)

  await logAudit({
    clinic_id: prescription.clinic_id,
    prescription_id: prescriptionId,
    event_type: 'PRESCRIPTION_CANCELLED',
    previous_status: prescription.status,
    new_status: 'CANCELADA',
    metadata: { reason },
  })

  return true
}

export async function toggleLegalHold(prescriptionId: string, reason: string, activate: boolean) {
  const admin = createServiceClient()

  const { data: prescription } = await admin
    .from('prescriptions')
    .select('clinic_id, status')
    .eq('id', prescriptionId)
    .single()

  if (!prescription) throw new Error('Prescription not found')

  await admin
    .from('prescriptions')
    .update({
      legal_hold: activate,
      legal_hold_reason: activate ? reason : null,
      status: activate ? 'EM_RETENCAO_LEGAL' : prescription.status,
    })
    .eq('id', prescriptionId)

  await logAudit({
    clinic_id: prescription.clinic_id,
    prescription_id: prescriptionId,
    event_type: activate ? 'LEGAL_HOLD_ACTIVATED' : 'LEGAL_HOLD_REMOVED',
    metadata: { reason },
  })

  return true
}

async function logAudit(data: {
  clinic_id: string
  prescription_id: string
  prescription_version_id?: string
  event_type: string
  previous_status?: string
  new_status?: string
  metadata?: unknown
}) {
  try {
    const admin = createServiceClient()

    await admin.from('prescription_audit_logs').insert({
      clinic_id: data.clinic_id,
      prescription_id: data.prescription_id,
      prescription_version_id: data.prescription_version_id ?? null,
      user_id: null,
      event_type: data.event_type,
      previous_status: data.previous_status ?? null,
      new_status: data.new_status ?? null,
      metadata: data.metadata ?? null,
    })
  } catch (err) {
    console.error('Audit log error:', err)
    // Never throw from audit logging
  }
}
