'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, ShoppingCart, X, FileText, Building2, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Compra, Fornecedor } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function ComprasPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<(Compra & { fornecedores?: Fornecedor })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mount, setMount] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await createClient()
          .from('compras')
          .select('*, fornecedores(*)')
          .order('created_at', { ascending: false })
        if (data) setCompras(data)
      } catch (err) {
        console.error('Erro ao carregar compras:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return compras
    return compras.filter(c =>
      (c.numero_nota && c.numero_nota.toLowerCase().includes(q)) ||
      (c.fornecedores?.nome_fantasia?.toLowerCase().includes(q)) ||
      (c.fornecedores?.razao_social?.toLowerCase().includes(q))
    )
  }, [compras, search])

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Compras</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${compras.length} compra${compras.length !== 1 ? 's' : ''} registrada${compras.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/estoque/compras/nova')}
          className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97]">
          <Plus className="mr-1.5 h-4 w-4" />Nova Compra
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
        <input ref={inputRef} placeholder="Buscar por nota ou fornecedor…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
        {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        {!loading && search && <p className="mt-1.5 text-[13px] text-muted-foreground/60">{filtered.length} de {compras.length}</p>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : compras.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20"><ShoppingCart className="h-7 w-7 text-blue-500 dark:text-blue-400" /></div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhuma compra ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">Registre a primeira compra para começar</p>
          <Button onClick={() => router.push('/dashboard/estoque/compras/nova')} className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium">
            <Plus className="mr-1.5 h-4 w-4" />Nova Compra
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground/30" /></div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Nenhum resultado</h3>
          <p className="text-[14px] text-muted-foreground">Tente ajustar sua busca</p>
          <Button variant="outline" onClick={clearSearch} className="mt-5 h-9 rounded-xl text-[13px]">Limpar busca</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Nº Nota</th>
                <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Fornecedor</th>
                <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Data</th>
                <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Valor Total</th>
                <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((compra) => (
                <tr key={compra.id} className="border-b border-border/50 last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><FileText className="h-4 w-4 text-muted-foreground/50" /></div>
                      <span className="text-[14px] font-medium text-foreground">{compra.numero_nota || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-[14px] text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground/40" />
                      {compra.fornecedores?.nome_fantasia || compra.fornecedores?.razao_social || '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(compra.data_compra)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-[14px] font-medium text-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40" />
                      {formatCurrency(compra.valor_total)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[12px]"
                      onClick={() => router.push(`/dashboard/estoque/lotes?compra=${compra.id}`)}>
                      Ver Lotes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}