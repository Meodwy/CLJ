const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://gqkyjfrbgodcjiciwmbz.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4'

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CLINIC_ID = '00000000-0000-0000-0000-000000000000'
const PATIENT_ID = 'dc52fe24-280d-4a25-ba1c-d5be96928d22'
const RX_ID = 'c883295d-9bd1-4287-8a45-c803b7c495cf'
const RX_VER_ID = '00000000-0000-0000-0000-000000000000'
const ADMIN_ID = 'cabee5b7-0fad-43be-8b6f-9f659f9a7e20'
const MANIPULADOR_ID = '3a131664-ce3f-477c-8c79-a90febe3faef'
const FARMACEUTICO_ID = 'c0f1e05a-3975-41bf-a328-f12d71e6beee'
const ITEM_ID = 'd38deaa8-7be9-4647-8db5-cf27f25c0f4f'

function uuid() {
  return crypto.randomUUID()
}

async function createOrder(data) {
  const orderId = uuid()
  const formulaId = uuid()
  const now = new Date()

  const order = {
    id: orderId,
    clinic_id: CLINIC_ID,
    patient_id: PATIENT_ID,
    prescription_id: RX_ID,
    prescription_version_id: RX_VER_ID,
    internal_number: data.number,
    pharmaceutical_form: data.form,
    requested_quantity: data.qty,
    requested_unit: data.unit,
    status: data.status,
    priority: data.priority || 'NORMAL',
    created_by: ADMIN_ID,
    pharmacist_id: data.pharmacist ? FARMACEUTICO_ID : null,
    assigned_manipulator_id: data.manipulator ? MANIPULADOR_ID : null,
    cancellation_reason: data.cancelReason || null,
    created_at: data.createdAt,
    released_at: data.releasedAt || null,
    ready_at: data.readyAt || null,
    dispensed_at: data.dispensedAt || null,
  }

  const formula = {
    id: formulaId,
    order_id: orderId,
    version_number: 1,
    status: 'ACTIVE',
    formula_data: { instructions: 'Formula personalizada' },
    calculation_data: { totalQuantity: data.qty, unit: data.unit, batchSize: data.qty, overage: data.overage || 0 },
    created_by: ADMIN_ID,
    created_at: data.createdAt,
  }

  const item = {
    id: uuid(),
    order_id: orderId,
    formula_id: formulaId,
    inventory_item_id: ITEM_ID,
    item_type: data.itemType || 'ACTIVE_INGREDIENT',
    theoretical_quantity: data.qty,
    technical_margin_quantity: data.overage || 0,
    total_required_quantity: data.qty + (data.overage || 0),
    unit: data.unit,
    sequence: 1,
    created_at: now.toISOString(),
  }

  const history = {
    id: uuid(),
    clinic_id: CLINIC_ID,
    order_id: orderId,
    previous_status: data.prevStatus || null,
    new_status: data.status,
    changed_by: ADMIN_ID,
    changed_at: data.createdAt,
  }

  const { error: e1 } = await supabase.from('compounding_orders').insert(order)
  if (e1) throw new Error(`order: ${e1.message}`)

  const { error: e2 } = await supabase.from('compounding_formulas').insert(formula)
  if (e2) throw new Error(`formula: ${e2.message}`)

  const { error: e3 } = await supabase.from('compounding_order_items').insert(item)
  if (e3) throw new Error(`item: ${e3.message}`)

  const { error: e4 } = await supabase.from('compounding_status_history').insert(history)
  if (e4) throw new Error(`history: ${e4.message}`)

  console.log(`  OK ${data.number} — ${data.status}`)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function hoursAgo(n) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d.toISOString()
}

let seq = 1
function num() {
  const n = String(seq).padStart(4, '0')
  seq++
  return `MC-${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${n}`
}

async function main() {
  // Skip cleanup — just append data

  // Helper to create batch
  async function batch(statuses, opts = {}) {
    if (Array.isArray(statuses)) {
      for (const s of statuses) {
        await createOrder({ ...opts, status: s, number: num(), createdAt: opts.hoursAgo ? hoursAgo(opts.hoursAgo * (opts.idx || 1)) : daysAgo(opts.daysAgo || 5) })
      }
    } else {
      await createOrder({ ...opts, status: statuses, number: num(), createdAt: opts.hoursAgo ? hoursAgo(opts.hoursAgo) : daysAgo(opts.daysAgo || 5) })
    }
  }

  console.log('\nCriando ordens...')

  // ANALISE (5)
  await batch(['DRAFT', 'AWAITING_PHARMACEUTICAL_REVIEW', 'PRESCRIPTION_PENDING', 'PRESCRIPTION_REJECTED', 'APPROVED_FOR_PRODUCTION'], { form: 'Capsula', qty: 60, unit: 'un', daysAgo: 5 })

  // ESTOQUE (4)
  await batch(['CHECKING_STOCK', 'MISSING_STOCK', 'AWAITING_PURCHASE', 'STOCK_RESERVED'], { form: 'Solucao', qty: 200, unit: 'ml', priority: 'HIGH', daysAgo: 4, itemType: 'ACTIVE_INGREDIENT', overage: 10 })

  // FILA (1)
  await batch('QUEUED_FOR_PRODUCTION', { form: 'Pomada', qty: 50, unit: 'g', daysAgo: 3, prevStatus: 'STOCK_RESERVED', itemType: 'BASE', overage: 2 })

  // SEPARACAO (1)
  await batch('IN_SEPARATION', { form: 'Capsula', qty: 30, unit: 'un', priority: 'URGENT', daysAgo: 2, prevStatus: 'QUEUED_FOR_PRODUCTION', manipulator: true })

  // PESAGEM (2)
  await batch('AWAITING_WEIGHING', { form: 'Suspensao', qty: 150, unit: 'ml', hoursAgo: 18, prevStatus: 'IN_SEPARATION', manipulator: true })
  await batch('IN_WEIGHING', { form: 'Suspensao', qty: 150, unit: 'ml', hoursAgo: 12, prevStatus: 'AWAITING_WEIGHING', manipulator: true })

  // MANIPULACAO (1)
  await batch('IN_COMPOUNDING', { form: 'Creme', qty: 100, unit: 'g', priority: 'HIGH', hoursAgo: 6, prevStatus: 'IN_WEIGHING', manipulator: true, itemType: 'BASE', overage: 3 })

  // CONTROLE (4 - simplified from 6)
  await batch('IN_PROCESS_CONTROL', { form: 'Capsula', qty: 90, unit: 'un', hoursAgo: 8, prevStatus: 'IN_COMPOUNDING', manipulator: true })
  await batch('AWAITING_PACKAGING', { form: 'Capsula', qty: 90, unit: 'un', hoursAgo: 6, prevStatus: 'IN_PROCESS_CONTROL', manipulator: true })
  await batch('PRODUCTION_COMPLETED', { form: 'Capsula', qty: 90, unit: 'un', hoursAgo: 4, prevStatus: 'AWAITING_PACKAGING', manipulator: true })
  await batch('REWORK_REQUIRED', { form: 'Capsula', qty: 90, unit: 'un', hoursAgo: 2, prevStatus: 'AWAITING_FINAL_QUALITY_CONTROL', manipulator: true })

  // LIBERACAO (3)
  await batch('AWAITING_PHARMACIST_RELEASE', { form: 'Solucao', qty: 300, unit: 'ml', hoursAgo: 10, prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true })
  await batch('RELEASE_REJECTED', { form: 'Solucao', qty: 300, unit: 'ml', hoursAgo: 6, prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true })
  await batch('RELEASED_BY_PHARMACIST', { form: 'Solucao', qty: 300, unit: 'ml', hoursAgo: 3, prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true })

  // PRONTA (1)
  await batch('READY_FOR_PICKUP', { form: 'Pomada', qty: 30, unit: 'g', hoursAgo: 1, prevStatus: 'RELEASED_BY_PHARMACIST', pharmacist: true, itemType: 'BASE', readyAt: new Date().toISOString(), releasedAt: hoursAgo(2) })

  // ENTREGUE (2)
  const deliveredAt = daysAgo(1)
  await batch('OUT_FOR_DELIVERY', { form: 'Capsula', qty: 120, unit: 'un', priority: 'LOW', daysAgo: 2, prevStatus: 'READY_FOR_PICKUP', pharmacist: true, overage: 5, releasedAt: daysAgo(3), readyAt: daysAgo(3), dispensedAt: deliveredAt })
  await batch('DISPENSED', { form: 'Capsula', qty: 120, unit: 'un', priority: 'LOW', daysAgo: 3, prevStatus: 'READY_FOR_PICKUP', pharmacist: true, overage: 5, releasedAt: daysAgo(4), readyAt: daysAgo(4), dispensedAt: deliveredAt })

  // CANCELADO (1)
  await batch('CANCELLED', { form: 'Gel', qty: 80, unit: 'g', priority: 'LOW', daysAgo: 6, prevStatus: 'AWAITING_PHARMACEUTICAL_REVIEW', itemType: 'BASE', overage: 2, cancelReason: 'Paciente desistiu do tratamento' })

  console.log(`\nTotal: ${seq - 1} ordens criadas!`)
}

main().catch(console.error)
