import { NextRequest, NextResponse } from 'next/server'
import { startReview, submitReview } from '@/lib/receitas/service'
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

    const body = await request.json()

    if (body.decision) {
      const result = await submitReview({ ...body, prescription_id: id })
      return NextResponse.json(result, { status: 201 })
    }

    const result = await startReview(id)
    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('Erro ao processar revisão de receita:', error)
    return NextResponse.json({ error: 'Erro interno ao processar revisão de receita' }, { status: 500 })
  }
}
