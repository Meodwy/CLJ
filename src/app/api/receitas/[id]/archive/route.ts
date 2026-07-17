import { NextRequest, NextResponse } from 'next/server'
import { archivePrescription } from '@/lib/receitas/service'
import { createServiceClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const admin = createServiceClient()
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID da receita é obrigatório' }, { status: 400 })

    const result = await archivePrescription(id)
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('Erro ao arquivar receita:', error)
    return NextResponse.json({ error: 'Erro interno ao arquivar receita' }, { status: 500 })
  }
}
