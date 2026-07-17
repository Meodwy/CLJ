import { NextRequest, NextResponse } from 'next/server'
import { cancelPrescription } from '@/lib/receitas/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID da receita é obrigatório' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json(
        { error: 'Campo obrigatório: reason' },
        { status: 400 }
      )
    }

    const result = await cancelPrescription(id, reason)

    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('Erro ao cancelar receita:', error)
    return NextResponse.json(
      { error: 'Erro interno ao cancelar receita' },
      { status: 500 }
    )
  }
}
