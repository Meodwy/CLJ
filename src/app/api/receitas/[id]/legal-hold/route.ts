import { NextRequest, NextResponse } from 'next/server'
import { toggleLegalHold } from '@/lib/receitas/service'

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
    const { reason, activate } = body

    if (activate === undefined || typeof activate !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo obrigatório: activate (boolean)' },
        { status: 400 }
      )
    }

    if (activate && !reason) {
      return NextResponse.json(
        { error: 'Campo obrigatório: reason (necessário para ativar retenção legal)' },
        { status: 400 }
      )
    }

    const result = await toggleLegalHold(id, reason, activate)

    return NextResponse.json({ success: result })
  } catch (error) {
    console.error('Erro ao alternar retenção legal:', error)
    return NextResponse.json(
      { error: 'Erro interno ao alternar retenção legal' },
      { status: 500 }
    )
  }
}
