import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createServiceClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'administrador') {
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })
  }

  const results: { name: string; pass: boolean; error?: string }[] = []

  // ── Test 1: FEFO consumes oldest lot first ──
  try {
    const { data: prod, error: prodErr } = await supabase
      .from('produtos')
      .insert({ nome: `T-FEFO-${Date.now()}`, ativo: true })
      .select('id')
      .single()
    if (prodErr) throw new Error(`create product: ${prodErr.message}`)
    if (!prod) throw new Error('create product: returned null')

    const lots = await supabase
      .from('lotes')
      .insert([
        { produto_id: prod.id, numero_lote: 'OLD', data_validade: '2026-08-01', quantidade_recebida: 100, quantidade_disponivel: 100, status: 'APPROVED' },
        { produto_id: prod.id, numero_lote: 'MID', data_validade: '2026-09-01', quantidade_recebida: 100, quantidade_disponivel: 100, status: 'APPROVED' },
        { produto_id: prod.id, numero_lote: 'NEW', data_validade: '2026-10-01', quantidade_recebida: 100, quantidade_disponivel: 100, status: 'APPROVED' },
      ])
      .select('id,numero_lote,quantidade_disponivel')

    const { data: fefoResult, error: fefoError } = await supabase.rpc('consumir_fefo', {
      p_produto_id: prod.id,
      p_quantidade: 150,
      p_user_id: null,
      p_movimento_tipo: 'saida',
      p_ordem_id: null,
    })

    if (fefoError) throw fefoError

    const oldLot = lots.data?.find(l => l.numero_lote === 'OLD')
    const midLot = lots.data?.find(l => l.numero_lote === 'MID')
    const newLot = lots.data?.find(l => l.numero_lote === 'NEW')

    const { data: oldAfter } = await supabase.from('lotes').select('quantidade_disponivel').eq('id', oldLot!.id).single()
    const { data: midAfter } = await supabase.from('lotes').select('quantidade_disponivel').eq('id', midLot!.id).single()
    const { data: newAfter } = await supabase.from('lotes').select('quantidade_disponivel').eq('id', newLot!.id).single()

    const fefoOk = fefoResult?.total_atendido === true
      && oldAfter?.quantidade_disponivel === 0
      && midAfter?.quantidade_disponivel === 50
      && newAfter?.quantidade_disponivel === 100

    // Cleanup
    await supabase.from('movimentacoes').delete().eq('produto_id', prod.id)
    await supabase.from('lotes').delete().in('id', [oldLot!.id, midLot!.id, newLot!.id])
    await supabase.from('produtos').delete().eq('id', prod.id)

    results.push({ name: 'FEFO oldest lot consumed first', pass: fefoOk })
  } catch (e: any) {
    results.push({ name: 'FEFO oldest lot consumed first', pass: false, error: e.message })
  }

  // ── Test 2: Sale auto-creates AR ──
  try {
    const { data: paciente, error: pacErr } = await supabase
      .from('pacientes')
      .insert({ nome: `T-AR-${Date.now()}`, cpf: `${Date.now()}`.slice(0,11), telefone: '11999999999' })
      .select('id')
      .single()
    if (pacErr) throw new Error(`patient insert: ${pacErr.message}`)
    if (!paciente) throw new Error('patient insert returned null')

    const { data: venda, error: vendErr } = await supabase
      .from('vendas')
      .insert({ paciente_id: paciente.id, valor_total: 150, forma_pagamento: 'dinheiro', data_venda: new Date().toISOString() })
      .select('id')
      .single()
    if (vendErr) throw new Error(`sale insert: ${vendErr.message}`)
    if (!venda) throw new Error('sale insert returned null')

    const { data: ar } = await supabase
      .from('accounts_receivable')
      .select('id,original_amount,outstanding_amount,status')
      .eq('sale_id', venda.id)
      .single()

    const arOk = ar?.original_amount === 150 && ar?.status === 'PENDING' && ar?.outstanding_amount === 150

    // Cleanup
    if (ar) await supabase.from('accounts_receivable').delete().eq('id', ar.id)
    await supabase.from('business_events').delete().eq('source_id', venda.id.toString())
    await supabase.from('vendas').delete().eq('id', venda.id)
    await supabase.from('pacientes').delete().eq('id', paciente.id)

    results.push({ name: 'Sale auto-creates accounts_receivable', pass: arOk })
  } catch (e: any) {
    results.push({ name: 'Sale auto-creates accounts_receivable', pass: false, error: e.message })
  }

  // ── Test 3: Inventory count generated columns ──
  try {
    const { data: prod, error: invProdErr } = await supabase
      .from('produtos')
      .insert({ nome: `T-INV-${Date.now()}`, ativo: true })
      .select('id')
      .single()
    if (invProdErr) throw new Error(`inv product: ${invProdErr.message}`)

    const { data: lot, error: lotErr } = await supabase
      .from('lotes')
      .insert({ produto_id: prod.id, numero_lote: 'INV-LOT', data_validade: '2026-12-01', quantidade_recebida: 50, quantidade_disponivel: 50, status: 'APPROVED' })
      .select('id')
      .single()
    if (lotErr) throw new Error(`inv lot: ${lotErr.message}`)

    const { data: count, error: countErr } = await supabase
      .from('inventory_counts')
      .insert({ clinic_id: '00000000-0000-0000-0000-000000000000', count_number: `T-${Date.now()}`, status: 'IN_PROGRESS' })
      .select('id')
      .single()
    if (countErr) throw new Error(`inv count: ${countErr.message}`)

    const { data: item } = await supabase
      .from('inventory_count_items')
      .insert({ inventory_count_id: count.id, product_id: prod.id, lot_id: lot.id, system_quantity: 50, physical_quantity: 48, unit_cost: 10 })
      .select('difference_quantity,difference_cost')
      .single()

    const invOk = item?.difference_quantity === -2 && item?.difference_cost === -20

    // Cleanup
    await supabase.from('inventory_count_items').delete().eq('inventory_count_id', count.id)
    await supabase.from('inventory_counts').delete().eq('id', count.id)
    await supabase.from('lotes').delete().eq('id', lot.id)
    await supabase.from('produtos').delete().eq('id', prod.id)

    results.push({ name: 'Inventory count generated columns', pass: invOk })
  } catch (e: any) {
    results.push({ name: 'Inventory count generated columns', pass: false, error: e.message })
  }

  // ── Test 4: compounding_order_costs table exists ──
  try {
    const { data: costs, error: costsErr } = await supabase
      .from('compounding_order_costs')
      .select('id')
      .limit(1)
    if (costsErr) throw new Error(costsErr.message)
    results.push({ name: 'compounding_order_costs table accessible', pass: Array.isArray(costs) })
  } catch (e: any) {
    results.push({ name: 'compounding_order_costs table accessible', pass: false, error: e.message })
  }

  // ── Test 5: financial_accounts queryable ──
  try {
    const { data: accounts, error: acctErr } = await supabase.from('financial_accounts').select('id').limit(5)
    if (acctErr) throw new Error(acctErr.message)
    results.push({ name: 'financial_accounts queryable', pass: Array.isArray(accounts) })
  } catch (e: any) {
    results.push({ name: 'financial_accounts queryable', pass: false, error: e.message })
  }

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length

  return NextResponse.json({
    summary: `${passed} passed, ${failed} failed out of ${results.length}`,
    results,
  })
}
