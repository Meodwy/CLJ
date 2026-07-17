// ============================================================
// CLJ Clínica — Módulo Manipulação (Compounding)
// Service — operações via RPC (mutations) e SELECT (reads)
// ============================================================

import { createClient } from '@/lib/supabase/client'
import { createDirectClient } from '@/lib/supabase/direct-client'
import type {
  CompoundingOrder,
  CompoundingOrderStatus,
  CompoundingOrderWithRelations,
  CompoundingSummary,
  PriorityLevel,
  QualityDecision,
  ReleaseDecision,
  SignatureMethod,
} from './types'

// ─── Helpers ───────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

// ─── Mutations (via RPC) ───────────────────────────────────

export async function createOrder(data: {
  clinic_id: string
  patient_id: string
  prescription_id: string
  prescription_version_id: string
  pharmaceutical_form: string
  requested_quantity: number
  requested_unit: string
  priority?: PriorityLevel
  due_at?: string
  formula_data?: unknown
  calculation_data?: unknown
  items_json?: unknown[]
}) {
  const supabase = await createDirectClient()
  await getUserId()

  const { data: result, error } = await (supabase as any).rpc('create_compounding_order', {
    p_clinic_id: data.clinic_id,
    p_patient_id: data.patient_id,
    p_prescription_id: data.prescription_id,
    p_prescription_version_id: data.prescription_version_id,
    p_pharmaceutical_form: data.pharmaceutical_form,
    p_requested_quantity: data.requested_quantity,
    p_requested_unit: data.requested_unit,
    p_priority: data.priority ?? 'NORMAL',
    p_due_at: data.due_at ?? null,
    p_formula_data: data.formula_data ?? {},
    p_calculation_data: data.calculation_data ?? {},
    p_items_json: data.items_json ?? [],
  })

  if (error) throw error
  return result as CompoundingOrder
}

export async function submitReview(data: {
  order_id: string
  checklist_json?: unknown
  approved?: boolean
  notes?: string
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('submit_pharmaceutical_review', {
    p_order_id: data.order_id,
    p_checklist_json: data.checklist_json ?? {},
    p_approved: data.approved ?? true,
    p_notes: data.notes ?? null,
  })

  if (error) throw error
  return result as string
}

export async function checkStock(orderId: string) {
  const supabase = createClient()

  const { data: result, error } = await supabase.rpc('check_stock_availability', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as {
    order_id: string
    items: Array<{
      order_item_id: string
      inventory_item_id: string
      product_name: string
      required_qty: number
      unit: string
      available_qty: number
      status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE'
    }>
    all_available: boolean
    checked_at: string
  }
}

export async function reserveStock(orderId: string) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('reserve_inventory_for_order', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as string
}

export async function startSeparation(orderId: string, manipulatorId: string) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('start_separation', {
    p_order_id: orderId,
    p_manipulator_id: manipulatorId,
  })

  if (error) throw error
  return result as string
}

export async function confirmSeparation(separationId: string, checkedBy: string) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('confirm_separation', {
    p_separation_id: separationId,
    p_checked_by: checkedBy,
  })

  if (error) throw error
  return result as string
}

export async function registerWeighing(data: {
  order_item_id: string
  reservation_id: string
  sequence: number
  theoretical_qty: number
  actual_qty: number
  unit: string
  allowed_min?: number
  allowed_max?: number
  container_tare?: number
  gross_weight?: number
  equipment_id?: string
  notes?: string
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('register_weighing', {
    p_order_item_id: data.order_item_id,
    p_reservation_id: data.reservation_id,
    p_sequence: data.sequence,
    p_theoretical_qty: data.theoretical_qty,
    p_actual_qty: data.actual_qty,
    p_unit: data.unit,
    p_allowed_min: data.allowed_min ?? null,
    p_allowed_max: data.allowed_max ?? null,
    p_container_tare: data.container_tare ?? null,
    p_gross_weight: data.gross_weight ?? null,
    p_equipment_id: data.equipment_id ?? null,
    p_notes: data.notes ?? null,
  })

  if (error) throw error
  return result as string
}

export async function completeWeighing(orderId: string) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('complete_weighing', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as string
}

export async function startStep(stepId: string, userId: string) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('start_compounding_step', {
    p_step_id: stepId,
    p_user_id: userId,
  })

  if (error) throw error
  return result as string
}

export async function completeStep(data: {
  step_id: string
  measured_values?: unknown
  equipment_data?: unknown
  environment_data?: unknown
  notes?: string
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('complete_compounding_step', {
    p_step_id: data.step_id,
    p_measured_values: data.measured_values ?? null,
    p_equipment_data: data.equipment_data ?? null,
    p_environment_data: data.environment_data ?? null,
    p_notes: data.notes ?? null,
  })

  if (error) throw error
  return result as string
}

export async function completeProduction(orderId: string) {
  const supabase = createClient()

  const { data: result, error } = await supabase.rpc('complete_production', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as string
}

export async function registerQuality(data: {
  order_id: string
  checks_json?: unknown[]
  decision?: QualityDecision
  notes?: string
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('register_quality_result', {
    p_order_id: data.order_id,
    p_checks_json: data.checks_json ?? [],
    p_decision: data.decision ?? 'APPROVED',
    p_notes: data.notes ?? null,
  })

  if (error) throw error
  return result as string
}

export async function quarantineOrder(data: {
  order_id: string
  reason: string
  pharmacist_id: string
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('quarantine_order', {
    p_order_id: data.order_id,
    p_reason: data.reason,
    p_pharmacist_id: data.pharmacist_id,
  })

  if (error) throw error
  return result as string
}

export async function signRelease(data: {
  order_id: string
  pharmacist_name: string
  crf_number: string
  crf_state: string
  signature_method?: SignatureMethod
  decision?: ReleaseDecision
  notes?: string
  certificate_subject?: string
  certificate_issuer?: string
}) {
  const supabase = createClient()

  const { data: result, error } = await supabase.rpc('sign_pharmacist_release', {
    p_order_id: data.order_id,
    p_pharmacist_name: data.pharmacist_name,
    p_crf_number: data.crf_number,
    p_crf_state: data.crf_state,
    p_signature_method: data.signature_method ?? 'ADVANCED_ELECTRONIC_SIGNATURE',
    p_decision: data.decision ?? 'APPROVED',
    p_notes: data.notes ?? null,
    p_certificate_subject: data.certificate_subject ?? null,
    p_certificate_issuer: data.certificate_issuer ?? null,
  })

  if (error) throw error
  return result as string
}

export async function markReady(orderId: string) {
  const supabase = createClient()

  const { data: result, error } = await supabase.rpc('mark_ready_for_pickup', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as string
}

export async function markDispensed(orderId: string) {
  const supabase = createClient()

  const { data: result, error } = await supabase.rpc('mark_as_dispensed', {
    p_order_id: orderId,
  })

  if (error) throw error
  return result as string
}

export async function cancelOrder(data: {
  order_id: string
  reason: string
  after_weighing?: boolean
}) {
  const supabase = createClient()
  await getUserId()

  const { data: result, error } = await supabase.rpc('cancel_compounding_order', {
    p_order_id: data.order_id,
    p_reason: data.reason,
    p_after_weighing: data.after_weighing ?? false,
  })

  if (error) throw error
  return result as string
}

// ─── Read Queries (via .from().select()) ───────────────────

export async function listOrders(options?: {
  statusFilter?: CompoundingOrderStatus | CompoundingOrderStatus[]
  patientId?: string
  assignedTo?: string
  limit?: number
}) {
  const supabase = createClient()
  await getUserId()

  let query = supabase
    .from('compounding_orders')
    .select(`*`)
    .order('created_at', { ascending: false })

  if (options?.statusFilter) {
    const statuses = Array.isArray(options.statusFilter)
      ? options.statusFilter
      : [options.statusFilter]
    query = query.in('status', statuses)
  }

  if (options?.patientId) {
    query = query.eq('patient_id', options.patientId)
  }

  if (options?.assignedTo) {
    query = query.eq('assigned_manipulator_id', options.assignedTo)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error

  // Fetch patient names (no FK constraint, so separate query)
  const results = data as CompoundingOrder[]
  const patientIds = [...new Set(results.map(o => o.patient_id).filter(Boolean))]
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('pacientes')
      .select('id, nome')
      .in('id', patientIds)
    if (patients) {
      const map = Object.fromEntries(patients.map(p => [p.id, p]))
      results.forEach(o => { o.patient = map[o.patient_id] || null })
    }
  }

  return results
}

export async function getOrder(id: string) {
  const supabase = createClient()

  // Busca ordem + joins que tem FK
  const { data, error } = await supabase
    .from('compounding_orders')
    .select('*, formula:compounding_formulas(*), items:compounding_order_items(*), reservations:inventory_lot_reservations(*), weighings:compounding_weighings(*), steps:compounding_steps(*), status_history:compounding_status_history(*)')
    .eq('id', id)
    .single()
  if (error) throw error

  const result = data as any

  // Busca paciente (sem FK)
  if (result.patient_id) {
    const { data: patient, error: patientErr } = await supabase
      .from('pacientes')
      .select('id, nome, cpf, telefone')
      .eq('id', result.patient_id)
      .maybeSingle()
    if (patientErr) {
      console.error('Erro ao buscar paciente:', patientErr)
    }
    result.patient = patient || null
  }

  // Busca nomes dos produtos para os itens
  if (result.items && result.items.length > 0) {
    const productIds = [...new Set(result.items.map((i: any) => i.inventory_item_id).filter(Boolean))] as string[]
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('produtos')
        .select('id, nome')
        .in('id', productIds)
      if (products) {
        const productMap = Object.fromEntries(products.map(p => [p.id, p.nome]))
        result.items.forEach((item: any) => {
          item.inventory_item_name = productMap[item.inventory_item_id] || null
        })
      }
    }
  }

  // Busca pharmacist (se tiver)
  if (result.pharmacist_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('id', result.pharmacist_id)
      .single()
    result.pharmacist = p || null
  }

  // Busca assigned_manipulator (se tiver)
  if (result.assigned_manipulator_id) {
    const { data: m } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('id', result.assigned_manipulator_id)
      .single()
    result.assigned_manipulator = m || null
  }

  return result as CompoundingOrderWithRelations
}

export async function getSummary(): Promise<CompoundingSummary> {
  const supabase = createClient()

  const analysisStatuses: CompoundingOrderStatus[] = [
    'AWAITING_PHARMACEUTICAL_REVIEW',
    'PRESCRIPTION_PENDING',
    'APPROVED_FOR_PRODUCTION',
  ]

  const productionStatuses: CompoundingOrderStatus[] = [
    'QUEUED_FOR_PRODUCTION',
    'IN_SEPARATION',
    'AWAITING_WEIGHING',
    'IN_WEIGHING',
    'IN_COMPOUNDING',
    'IN_PROCESS_CONTROL',
    'AWAITING_PACKAGING',
    'IN_PACKAGING',
    'AWAITING_LABELING',
    'IN_LABELING',
    'PRODUCTION_COMPLETED',
    'REWORK_REQUIRED',
  ]

  const releaseStatuses: CompoundingOrderStatus[] = [
    'AWAITING_FINAL_QUALITY_CONTROL',
    'QUALITY_CONTROL_REJECTED',
    'QUARANTINED',
    'AWAITING_PHARMACIST_RELEASE',
    'RELEASE_REJECTED',
  ]

  const readyStatuses: CompoundingOrderStatus[] = [
    'RELEASED_BY_PHARMACIST',
    'READY_FOR_PICKUP',
  ]

  const activeStatuses: CompoundingOrderStatus[] = [
    ...analysisStatuses,
    ...productionStatuses,
    ...releaseStatuses,
    ...readyStatuses,
    'CHECKING_STOCK',
    'MISSING_STOCK',
    'AWAITING_PURCHASE',
    'STOCK_RESERVED',
  ]

  const { count: awaitingAnalysis } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', analysisStatuses)

  const { count: inProduction } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', productionStatuses)

  const { count: awaitingRelease } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', releaseStatuses)

  const { count: readyForPickup } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', readyStatuses)

  const { count: totalActive } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', activeStatuses)

  return {
    awaiting_analysis: awaitingAnalysis ?? 0,
    in_production: inProduction ?? 0,
    awaiting_release: awaitingRelease ?? 0,
    ready_for_pickup: readyForPickup ?? 0,
    total_active: totalActive ?? 0,
  }
}

export async function getOrderCountByStatus(
  clinicId: string,
  status: CompoundingOrderStatus
): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('compounding_orders')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', status)

  if (error) throw error
  return count ?? 0
}
