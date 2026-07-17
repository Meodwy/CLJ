import { NextRequest, NextResponse } from 'next/server'
import { consumirFefo } from '@/lib/estoque/fefo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { produtoId, quantidade, usuarioId, observacao } = body

    if (!produtoId || !quantidade || !usuarioId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: produtoId, quantidade, usuarioId' },
        { status: 400 }
      )
    }

    if (typeof quantidade !== 'number' || quantidade <= 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser um número positivo' },
        { status: 400 }
      )
    }

    const result = await consumirFefo({ produtoId, quantidade, usuarioId, observacao })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro no consumo FEFO:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar consumo FEFO' },
      { status: 500 }
    )
  }
}