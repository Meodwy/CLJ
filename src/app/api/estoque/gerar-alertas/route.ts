import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const admin = createServiceClient()

    // Verify the user is authenticated
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // Verify user role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['administrador', 'farmaceutico', 'estoquista'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    // Execute the alert generation function via RPC
    const { data, error: rpcError } = await admin.rpc('gerar_alertas_estoque')

    if (rpcError) {
      console.error('Erro ao gerar alertas:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    // Get count of unread alerts after generation
    const { count } = await admin
      .from('alertas')
      .select('*', { count: 'exact', head: true })
      .eq('lido', false)

    return NextResponse.json({
      success: true,
      message: 'Alertas gerados com sucesso',
      alertasNaoLidos: count ?? 0,
    })
  } catch (err) {
    console.error('Erro interno em gerar-alertas:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 })
}
