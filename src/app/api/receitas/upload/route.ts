import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import type { PrescriptionStatus } from '@/lib/receitas/types'

async function checkUserRole(token: string): Promise<{userId: string; role: string} | null> {
  const admin = createServiceClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return null
  return { userId: user.id, role: profile.role }
}

const BUCKET = 'medical-prescriptions'

function storagePath(clinicId: string, patientId: string, prescriptionId: string, versionId: string, filename: string) {
  return `clinics/${clinicId}/patients/${patientId}/prescriptions/${prescriptionId}/versions/${versionId}/${filename}`
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const session = await checkUserRole(token)
    if (!session) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Only administrador and farmaceutico can upload prescriptions
    if (session.role !== 'administrador' && session.role !== 'farmaceutico') {
      return NextResponse.json({ error: 'Sem permissão para fazer upload de receitas' }, { status: 403 })
    }

    const admin = createServiceClient()

    const formData = await request.formData()
    const prescription_id = formData.get('prescription_id') as string | null
    const file = formData.get('file') as File | null
    const upload_reason = formData.get('upload_reason') as string | null

    if (!prescription_id || !file) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: prescription_id, file' },
        { status: 400 }
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'O campo file deve ser um arquivo' },
        { status: 400 }
      )
    }

    // Get prescription
    const { data: prescription, error: rxErr } = await admin
      .from('prescriptions')
      .select('clinic_id, patient_id, status')
      .eq('id', prescription_id)
      .single()

    if (rxErr || !prescription) throw new Error('Prescription not found')
    if (['ARQUIVADA', 'CANCELADA', 'DESCARTADA'].includes(prescription.status as PrescriptionStatus)) {
      throw new Error('Cannot upload to archived/cancelled/discarded prescription')
    }

    // Get current version number
    const { data: versions } = await admin
      .from('prescription_versions')
      .select('version_number')
      .eq('prescription_id', prescription_id)
      .order('version_number', { ascending: false })
      .limit(1)

    const versionNumber = (versions?.[0]?.version_number ?? 0) + 1

    // Calculate SHA-256 hash
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Check duplicate hash
    const { data: existingHash } = await admin
      .from('prescription_versions')
      .select('prescription_id, storage_object_key')
      .eq('file_hash_sha256', fileHash)
      .single()

    if (existingHash && existingHash.prescription_id !== prescription_id) {
      throw new Error('File already exists in another prescription')
    }

    // Upload to Storage
    const versionId = crypto.randomUUID()
    const objectKey = storagePath(
      prescription.clinic_id,
      prescription.patient_id,
      prescription_id,
      versionId,
      file.name
    )

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectKey, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Mark previous versions as not current
    if (versionNumber > 1) {
      await admin
        .from('prescription_versions')
        .update({ is_current: false })
        .eq('prescription_id', prescription_id)
    }

    // Create version record
    const { data: version, error: versionError } = await admin
      .from('prescription_versions')
      .insert({
        id: versionId,
        prescription_id,
        version_number: versionNumber,
        storage_object_key: objectKey,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_hash_sha256: fileHash,
        uploaded_by: session.userId,
        upload_reason: upload_reason ?? null,
        is_current: true,
      })
      .select()
      .single()

    if (versionError) {
      // Rollback storage
      await admin.storage.from(BUCKET).remove([objectKey])
      throw versionError
    }

    // Update prescription with current version and status
    const newStatus: PrescriptionStatus = prescription.status === 'RASCUNHO' ? 'AGUARDANDO_CONFERENCIA' : prescription.status as PrescriptionStatus
    await admin
      .from('prescriptions')
      .update({
        current_version_id: versionId,
        status: newStatus,
      })
      .eq('id', prescription_id)

    // Audit log
    await admin.from('prescription_audit_logs').insert({
      clinic_id: prescription.clinic_id,
      prescription_id,
      prescription_version_id: versionId,
      user_id: session.userId,
      event_type: 'FILE_UPLOADED',
      new_status: newStatus,
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de receita:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao fazer upload de receita' },
      { status: 500 }
    )
  }
}
