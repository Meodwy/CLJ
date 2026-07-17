const API = 'https://gqkyjfrbgodcjiciwmbz.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }
const J = (o, m = 'POST') => fetch(`${API}/${o}`, { method: m, headers: H, body: JSON.stringify({ ...arguments[2] }) })
const POST = (t, d) => fetch(`${API}/${t}`, { method: 'POST', headers: H, body: JSON.stringify(d) })

const ADMIN = 'cabee5b7-0fad-43be-8b6f-9f659f9a7e20'
const MANIP = '3a131664-ce3f-477c-8c79-a90febe3faef'
const FARMA = 'c0f1e05a-3975-41bf-a328-f12d71e6beee'
const PAT = 'dc52fe24-280d-4a25-ba1c-d5be96928d22'
const RX = 'c883295d-9bd1-4287-8a45-c803b7c495cf'
const PROD = 'd38deaa8-7be9-4647-8db5-cf27f25c0f4f'
const MONTH = new Date().toISOString().slice(2, 7).replace('-', '')

const uid = () => crypto.randomUUID()
const ago = (h) => new Date(Date.now() + h * 3600000).toISOString()

async function api(method, table, body) {
  const res = await fetch(`${API}/${table}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text().catch(() => '')}`)
}

let seq = 1

async function createOrder({ status, form, qty, unit, priority, prevStatus, pharmacist, manipulator, hoursAgo, cancelReason }) {
  const n = String(seq).padStart(4, '0')
  seq++
  const num = `MC-${MONTH}-${n}`
  const ts = ago(hoursAgo || 0)
  const oid = uid(), fid = uid(), iid = uid(), hid = uid()

  const order = { id: oid, clinic_id: '00000000-0000-0000-0000-000000000000', patient_id: PAT, prescription_id: RX, prescription_version_id: '00000000-0000-0000-0000-000000000000', internal_number: num, pharmaceutical_form: form, requested_quantity: qty, requested_unit: unit, status, priority: priority || 'NORMAL', created_by: ADMIN, created_at: ts }
  if (pharmacist) order.pharmacist_id = FARMA
  if (manipulator) order.assigned_manipulator_id = MANIP
  if (cancelReason) order.cancellation_reason = cancelReason
  await api('POST', 'compounding_orders', order)

  const formula = { id: fid, order_id: oid, version_number: 1, status: 'ACTIVE', formula_data: { instructions: 'Fórmula personalizada' }, calculation_data: { totalQuantity: qty, unit, batchSize: qty, overage: 0 }, created_by: ADMIN, created_at: ts }
  await api('POST', 'compounding_formulas', formula)

  const item = { id: iid, order_id: oid, formula_id: fid, inventory_item_id: PROD, item_type: 'ACTIVE_INGREDIENT', theoretical_quantity: qty, technical_margin_quantity: 0, total_required_quantity: qty, unit, sequence: 1 }
  await api('POST', 'compounding_order_items', item)

  if (prevStatus) {
    const history = { id: hid, clinic_id: '00000000-0000-0000-0000-000000000000', order_id: oid, previous_status: prevStatus, new_status: status, changed_by: ADMIN, changed_at: ts }
    await api('POST', 'compounding_status_history', history)
  }

  console.log(`  OK ${num} — ${status}`)
}

async function main() {
  console.log('=== Seed Compounding Orders ===\n')

  const orders = [
    // ANALISE (5)
    { status: 'DRAFT', form: 'Cápsula', qty: 60, unit: 'un', hoursAgo: -120 },
    { status: 'AWAITING_PHARMACEUTICAL_REVIEW', form: 'Cápsula', qty: 60, unit: 'un', hoursAgo: -116 },
    { status: 'PRESCRIPTION_PENDING', form: 'Cápsula', qty: 60, unit: 'un', hoursAgo: -112 },
    { status: 'PRESCRIPTION_REJECTED', form: 'Cápsula', qty: 60, unit: 'un', hoursAgo: -108 },
    { status: 'APPROVED_FOR_PRODUCTION', form: 'Cápsula', qty: 60, unit: 'un', hoursAgo: -104 },
    // ESTOQUE (4)
    { status: 'CHECKING_STOCK', form: 'Solução', qty: 200, unit: 'ml', priority: 'HIGH', hoursAgo: -96 },
    { status: 'MISSING_STOCK', form: 'Solução', qty: 200, unit: 'ml', priority: 'HIGH', hoursAgo: -90 },
    { status: 'AWAITING_PURCHASE', form: 'Solução', qty: 200, unit: 'ml', priority: 'HIGH', hoursAgo: -84 },
    { status: 'STOCK_RESERVED', form: 'Solução', qty: 200, unit: 'ml', priority: 'HIGH', hoursAgo: -78 },
    // FILA (1)
    { status: 'QUEUED_FOR_PRODUCTION', form: 'Pomada', qty: 50, unit: 'g', prevStatus: 'STOCK_RESERVED', hoursAgo: -72 },
    // SEPARACAO (1)
    { status: 'IN_SEPARATION', form: 'Cápsula', qty: 30, unit: 'un', priority: 'URGENT', prevStatus: 'QUEUED_FOR_PRODUCTION', manipulator: true, hoursAgo: -48 },
    // PESAGEM (2)
    { status: 'AWAITING_WEIGHING', form: 'Suspensão', qty: 150, unit: 'ml', prevStatus: 'IN_SEPARATION', manipulator: true, hoursAgo: -18 },
    { status: 'IN_WEIGHING', form: 'Suspensão', qty: 150, unit: 'ml', prevStatus: 'AWAITING_WEIGHING', manipulator: true, hoursAgo: -12 },
    // MANIPULACAO (1)
    { status: 'IN_COMPOUNDING', form: 'Creme', qty: 100, unit: 'g', priority: 'HIGH', prevStatus: 'IN_WEIGHING', manipulator: true, hoursAgo: -6 },
    // CONTROLE (4)
    { status: 'IN_PROCESS_CONTROL', form: 'Cápsula', qty: 90, unit: 'un', prevStatus: 'IN_COMPOUNDING', manipulator: true, hoursAgo: -8 },
    { status: 'AWAITING_PACKAGING', form: 'Cápsula', qty: 90, unit: 'un', prevStatus: 'IN_PROCESS_CONTROL', manipulator: true, hoursAgo: -6 },
    { status: 'PRODUCTION_COMPLETED', form: 'Cápsula', qty: 90, unit: 'un', prevStatus: 'AWAITING_PACKAGING', manipulator: true, hoursAgo: -4 },
    { status: 'REWORK_REQUIRED', form: 'Cápsula', qty: 90, unit: 'un', prevStatus: 'AWAITING_FINAL_QUALITY_CONTROL', manipulator: true, hoursAgo: -2 },
    // LIBERACAO (3)
    { status: 'AWAITING_PHARMACIST_RELEASE', form: 'Solução', qty: 300, unit: 'ml', prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true, hoursAgo: -10 },
    { status: 'RELEASE_REJECTED', form: 'Solução', qty: 300, unit: 'ml', prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true, hoursAgo: -6 },
    { status: 'RELEASED_BY_PHARMACIST', form: 'Solução', qty: 300, unit: 'ml', prevStatus: 'PRODUCTION_COMPLETED', pharmacist: true, hoursAgo: -3 },
    // PRONTA (1)
    { status: 'READY_FOR_PICKUP', form: 'Pomada', qty: 30, unit: 'g', prevStatus: 'RELEASED_BY_PHARMACIST', pharmacist: true, hoursAgo: -1 },
    // ENTREGUE (2)
    { status: 'OUT_FOR_DELIVERY', form: 'Cápsula', qty: 120, unit: 'un', priority: 'LOW', prevStatus: 'READY_FOR_PICKUP', pharmacist: true, hoursAgo: -48 },
    { status: 'DISPENSED', form: 'Cápsula', qty: 120, unit: 'un', priority: 'LOW', prevStatus: 'READY_FOR_PICKUP', pharmacist: true, hoursAgo: -72 },
    // CANCELADO (1)
    { status: 'CANCELLED', form: 'Gel', qty: 80, unit: 'g', priority: 'LOW', prevStatus: 'AWAITING_PHARMACEUTICAL_REVIEW', hoursAgo: -144, cancelReason: 'Paciente desistiu do tratamento' },
  ]

  for (const o of orders) {
    try {
      await createOrder(o)
    } catch (e) {
      console.error(`  FAIL ${o.status}: ${e.message}`)
      process.exit(1)
    }
  }

  console.log(`\nTotal: ${seq - 1} ordens criadas!`)
}

main()
