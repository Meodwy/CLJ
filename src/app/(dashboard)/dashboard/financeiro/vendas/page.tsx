'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Search, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formaPagamentoLabels, type Venda } from '@/lib/supabase/types'

export default function VendasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mount, setMount] = useState(false)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => { loadVendas() }, [])

  async function loadVendas() {
    setLoading(true)
    const { data } = await supabase
      .from('vendas')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setVendas(data)
    setLoading(false)
  }

  const filtered = vendas.filter(v =>
    !search || v.forma_pagamento.toLowerCase().includes(search.toLowerCase()) ||
    (v.observacao || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalReceita = vendas.reduce((acc, v) => acc + Number(v.valor_total), 0)

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div
        className={`mb-8 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Vendas</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {vendas.length} registro(s) &middot; Total: R$ {totalReceita.toFixed(2)}
            </p>
          </div>
          <Button
            onClick={() => router.push('/dashboard/financeiro/vendas/nova')}
            className="h-10 rounded-xl bg-primary px-4 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97]"
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            <Plus className="mr-1.5 h-4 w-4" />Nova Venda
          </Button>
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar vendas..."
            className="h-10 rounded-xl pl-8 text-[13px]"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      ) : (
        <div
          className={`rounded-xl border border-border bg-card shadow-sm transition-all duration-500 ease-[var(--ease-out)] delay-75 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {search ? 'Nenhuma venda encontrada' : 'Nenhuma venda registrada'}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_auto] gap-4 px-6 py-3 text-[12px] font-medium text-muted-foreground/60">
                <span>Data</span>
                <span>Pagamento</span>
                <span className="text-right">Valor</span>
                <span>Observação</span>
                <span className="w-10" />
              </div>
              {filtered.map(venda => (
                <div
                  key={venda.id}
                  className="grid grid-cols-[1fr_1fr_1fr_1.5fr_auto] gap-4 px-6 py-3.5 text-[13px] items-center transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/20"
                >
                  <span className="text-foreground">
                    {new Date(venda.data_venda + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-muted-foreground">{formaPagamentoLabels[venda.forma_pagamento]}</span>
                  <span className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    R$ {Number(venda.valor_total).toFixed(2)}
                  </span>
                  <span className="truncate text-muted-foreground/60">{venda.observacao || '—'}</span>
                  <button
                    onClick={() => router.push('/dashboard/financeiro/vendas')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/30 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
