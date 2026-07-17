import { NextRequest, NextResponse } from 'next/server'
import { getPrescription } from '@/lib/receitas/service'

export async function GET(
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

    const result = await getPrescription(id)

    if (!result) {
      return NextResponse.json(
        { error: 'Receita não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar receita:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar receita' },
      { status: 500 }
    )
  }
}
