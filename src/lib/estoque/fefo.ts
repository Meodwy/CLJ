import { createClient } from '@/lib/supabase/client'

interface ConsumirFefoParams {
  produtoId: string
  quantidade: number
  usuarioId: string
  observacao?: string
}

export async function consumirFefo(params: ConsumirFefoParams) {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('consumir_fefo', {
    p_produto_id: params.produtoId,
    p_quantidade: params.quantidade,
    p_user_id: params.usuarioId,
    p_movimento_tipo: 'saida',
    p_ordem_id: null,
  })

  if (error) {
    return { success: false, error: error.message, lotesConsumidos: [] as { loteId: string; quantidade: number }[] }
  }

  const result = data as {
    total_atendido: boolean
    quantidade_consumida: number
    restante: number
    lotes: { lote_id: string; numero_lote: string; consumido: number }[]
  }

  return {
    success: result.total_atendido,
    error: result.restante > 0 ? `Faltou estoque para ${result.restante} unidade(s)` : undefined,
    lotesConsumidos: result.lotes.map((l: any) => ({ loteId: l.lote_id, quantidade: l.consumido })),
  }
}
