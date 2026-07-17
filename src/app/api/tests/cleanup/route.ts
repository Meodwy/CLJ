import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
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

  const results: string[] = []

  const delPac = await supabase.from('pacientes').delete().like('nome', 'T-%')
  results.push(`pacientes: ${delPac.status}`)

  const delProd = await supabase.from('produtos').delete().like('nome', 'T-%')
  results.push(`produtos: ${delProd.status}`)

  const delInv = await supabase.from('inventory_counts').delete().like('count_number', 'T-%')
  results.push(`inventory_counts: ${delInv.status}`)

  const delLot = await supabase.from('lotes').delete().in('numero_lote', ['OLD','MID','NEW','INV-LOT','T-OLD','T-MID','T-NEW'])
  results.push(`lotes: ${delLot.status}`)

  return NextResponse.json({ cleaned: results })
}
