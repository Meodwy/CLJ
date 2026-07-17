import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: vi.fn(), rpc: mockRpc }),
}))

import { consumirFefo } from '@/lib/estoque/fefo'

describe('consumirFefo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consumes stock via FEFO and returns success', async () => {
    const mockResult = {
      total_atendido: true,
      quantidade_consumida: 150,
      restante: 0,
      lotes: [
        { lote_id: 'lot-1', numero_lote: 'LOT-001', consumido: 100 },
        { lote_id: 'lot-2', numero_lote: 'LOT-002', consumido: 50 },
      ],
    }

    mockRpc.mockResolvedValue({ data: mockResult, error: null })

    const result = await consumirFefo({
      produtoId: 'prod-123',
      quantidade: 150,
      usuarioId: 'user-1',
    })

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.lotesConsumidos).toHaveLength(2)
    expect(result.lotesConsumidos![0]).toEqual({ loteId: 'lot-1', quantidade: 100 })

    expect(mockRpc).toHaveBeenCalledWith('consumir_fefo', {
      p_produto_id: 'prod-123',
      p_quantidade: 150,
      p_user_id: 'user-1',
      p_movimento_tipo: 'saida',
      p_ordem_id: null,
    })
  })

  it('returns partial consumption error when stock insufficient', async () => {
    const mockResult = {
      total_atendido: false,
      quantidade_consumida: 80,
      restante: 20,
      lotes: [{ lote_id: 'lot-1', numero_lote: 'LOT-001', consumido: 80 }],
    }

    mockRpc.mockResolvedValue({ data: mockResult, error: null })

    const result = await consumirFefo({
      produtoId: 'prod-123',
      quantidade: 100,
      usuarioId: 'user-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('20')
    expect(result.lotesConsumidos).toHaveLength(1)
  })

  it('handles RPC error gracefully', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC timeout') })

    const result = await consumirFefo({
      produtoId: 'prod-123',
      quantidade: 50,
      usuarioId: 'user-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(Array.isArray(result.lotesConsumidos)).toBe(true)
  })
})
