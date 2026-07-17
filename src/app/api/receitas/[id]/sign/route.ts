import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da receita é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { review_id, signature_method, certificate_subject, certificate_issuer, pharmacist_id } = body

    if (!review_id || !signature_method) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: review_id, signature_method' },
        { status: 400 }
      )
    }

    if (!pharmacist_id) {
      return NextResponse.json(
        { error: 'pharmacist_id é obrigatório' },
        { status: 400 }
      )
    }

    const admin = createServiceClient()

    // Get the current version's file hash
    const { data: prescription } = await admin
      .from('prescriptions')
      .select('current_version_id, clinic_id, patient_id')
      .eq('id', id)
      .single()

    if (!prescription?.current_version_id) throw new Error('No current version found')

    const { data: version } = await admin
      .from('prescription_versions')
      .select('file_hash_sha256, storage_object_key, original_filename')
      .eq('id', prescription.current_version_id)
      .single()

    if (!version) throw new Error('Version not found')

    // Generate acceptance term hash and storage key
    const termHash = Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({
        prescription_id: id,
        review_id,
        signed_at: new Date().toISOString(),
        pharmacist_id,
      })))
    )).map(b => b.toString(16).padStart(2, '0')).join('')

    const termStorageKey = `clinics/${prescription.clinic_id}/patients/${prescription.patient_id}/prescriptions/${id}/acceptance-terms/${crypto.randomUUID()}/termo-conferencia.pdf`

    await admin.from('pharmacist_signatures').insert({
      prescription_id: id,
      review_id,
      pharmacist_id,
      signature_method,
      signature_status: 'COMPLETED',
      certificate_subject: certificate_subject ?? null,
      certificate_issuer: certificate_issuer ?? null,
      prescription_file_hash: version.file_hash_sha256,
      acceptance_term_hash: termHash,
      acceptance_term_storage_key: termStorageKey,
      signed_at: new Date().toISOString(),
    })

    // Update prescription to ARQUIVADA after signature
    await admin
      .from('prescriptions')
      .update({ status: 'ARQUIVADA', archived_at: new Date().toISOString() })
      .eq('id', id)

    await admin.from('prescription_audit_logs').insert({
      clinic_id: prescription.clinic_id,
      prescription_id: id,
      user_id: pharmacist_id,
      event_type: 'PHARMACIST_SIGNATURE_COMPLETED',
      new_status: 'ARQUIVADA',
      metadata: { signature_method },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Erro ao assinar receita:', error)
    return NextResponse.json(
      { error: 'Erro interno ao assinar receita' },
      { status: 500 }
    )
  }
}
