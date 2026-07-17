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

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')

    // Token optional — admin client bypasses RLS
    let userRole: string | null = null
    if (token) {
      const session = await checkUserRole(token)
      userRole = session?.role ?? null
    }

    const admin = createServiceClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PrescriptionStatus | null
    const patient_id = searchParams.get('patient_id')

    let query = admin
      .from('prescriptions')
      .select(`*`)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (patient_id) query = query.eq('patient_id', patient_id)

    const { data, error } = await query
    if (error) throw error

    // Fetch patient names (no FK constraint)
    const results = data as any[]
    if (results.length > 0) {
      const pids = [...new Set(results.map(r => r.patient_id).filter(Boolean))]
      const { data: patients } = await admin
        .from('pacientes')
        .select('id, nome')
        .in('id', pids)
      if (patients) {
        const map = Object.fromEntries(patients.map(p => [p.id, p.nome]))
        results.forEach(r => { r.patient_name = map[r.patient_id] || null })
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar receitas:', error)
    return NextResponse.json({ error: 'Erro interno ao listar receitas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const session = await checkUserRole(token)
    if (!session) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    // Only administrador and farmaceutico can create prescriptions
    if (session.role !== 'administrador' && session.role !== 'farmaceutico') {
      return NextResponse.json({ error: 'Sem permissão para criar receitas' }, { status: 403 })
    }

    const admin = createServiceClient()

    const body = await request.json()
    const {
      clinic_id, patient_id, prescriber_name, prescriber_registration,
      prescriber_registration_state, prescription_type, document_origin,
      issued_at, expires_at, physical_original_required,
      external_platform, external_id, external_validation_link,
    } = body

    if (!patient_id || !prescriber_name || !prescription_type || !document_origin) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: patient_id, prescriber_name, prescription_type, document_origin' },
        { status: 400 }
      )
    }

    const defaultClinicId = '00000000-0000-0000-0000-000000000001'

    const { data: prescription, error } = await admin
      .from('prescriptions')
      .insert({
        clinic_id: clinic_id || defaultClinicId,
        patient_id,
        prescriber_name,
        prescriber_registration: prescriber_registration || null,
        prescriber_registration_state: prescriber_registration_state || null,
        prescription_type,
        document_origin,
        status: 'RASCUNHO',
        issued_at: issued_at || null,
        expires_at: expires_at || null,
        physical_original_required: physical_original_required || false,
        external_platform: external_platform || null,
        external_id: external_id || null,
        external_validation_link: external_validation_link || null,
        created_by: session.userId,
      })
      .select()
      .single()

    if (error) throw error

    // Audit log
    await admin.from('prescription_audit_logs').insert({
      clinic_id: clinic_id || defaultClinicId,
      prescription_id: prescription.id,
      user_id: session.userId,
      event_type: 'PRESCRIPTION_CREATED',
      new_status: 'RASCUNHO',
    })

    return NextResponse.json(prescription, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar receita:', error)
    return NextResponse.json({ error: 'Erro interno ao criar receita' }, { status: 500 })
  }
}
