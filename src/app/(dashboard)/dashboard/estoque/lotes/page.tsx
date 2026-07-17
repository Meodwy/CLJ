'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Loader2, X, Package, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Lote, Produto, Fornecedor } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const val = new Date(dateStr)
  val.setHours(0, 0, 0, 0)
  return Math.ceil((val.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getValidadeColor(dateStr: string) {
  const days = daysUntil(dateStr)
  if (days < 0) return 'text-red-600 dark:text-red-400 font-medium' // expired
  if (days <= 30) return 'text-amber-600 dark:text-amber-400 font-medium'
  if (days <= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-muted-foreground'
}

function getValidadeBg(dateStr: string) {
  const days = daysUntil(dateStr)
  if (days < 0) return 'bg-red-50 dark:bg-red-950/20'
  if (days <= 30) return 'bg-amber-50 dark:bg-amber-950/20'
  if (days <= 60) return 'bg-yellow-50 dark:bg-yellow-950/20'
  return ''
}

export default function LotesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const compraFilter = searchParams.get('compra')

  const [lotes, setLotes] = useState<(Lote & { produtos?: Produto; fornecedores?: Fornecedor })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mount, setMount] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        let query = createClient()
          .from('lotes')
          .select('*, produtos(*), fornecedores(*)')
          .order('data_validade', { ascending: true })

        if (compraFilter) {
          query = query.eq('nota_fiscal', compraFilter)
        }

        const { data } = await query
        if (data) setLotes(data)
      } catch (err) {
        console.error('Erro ao carregar lotes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [compraFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lotes
    return lotes.filter(l =>
      (l.produtos?.nome?.toLowerCase().includes(q)) ||
      l.numero_lote.toLowerCase().includes(q) ||
      (l.produtos?.sku?.toLowerCase().includes(q))
    )
  }, [lotes, search])

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Lotes</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${lotes.length} lote${lotes.length !== 1 ? 's' : ''} registrado${lotes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
        <input ref={inputRef} placeholder="Buscar por produto, lote ou SKU…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
        {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        {!loading && search && <p className="mt-1.5 text-[13px] text-muted-foreground/60">{filtered.length} de {lotes.length}</p>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : lotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20"><Package className="h-7 w-7 text-blue-500 dark:text-blue-400" /></div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhum lote ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">Os lotes são criados automaticamente ao registrar compras</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground/30" /></div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Nenhum resultado</h3>
          <p className="text-[14px] text-muted-foreground">Tente ajustar sua busca</p>
          <Button variant="outline" onClick={clearSearch} className="mt-5 h-9 rounded-xl text-[13px]">Limpar busca</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Produto</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Nº Lote</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Validade</th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Recebida</th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Disponível</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Fornecedor</th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Custo Un.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lote) => {
                  const valBg = getValidadeBg(lote.data_validade)
                  const days = daysUntil(lote.data_validade)
                  return (
                    <tr key={lote.id}
                      onClick={() => router.push(`/dashboard/estoque/lotes/${lote.id}`)}
                      className={`border-b border-border/50 last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/30 cursor-pointer ${valBg}`}>
                      <td className="px-5 py-4">
                        <span className="text-[14px] font-medium text-foreground">{lote.produtos?.nome || '—'}</span>
                        {lote.produtos?.sku && (
                          <span className="ml-2 text-[12px] text-muted-foreground/50">{lote.produtos.sku}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[14px] text-foreground">{lote.numero_lote}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/40" />
                          <span className={`text-[14px] ${getValidadeColor(lote.data_validade)}`}>
                            {formatDate(lote.data_validade)}
                          </span>
                          {days < 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          {days >= 0 && days <= 60 && (
                            <span className="text-[11px] text-muted-foreground/60">
                              ({days === 0 ? 'hoje' : `${days}d`})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-[14px] text-foreground">{lote.quantidade_recebida}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={`text-[14px] font-medium ${lote.quantidade_disponivel === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                          {lote.quantidade_disponivel}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[14px] text-muted-foreground">{lote.fornecedores?.nome_fantasia || lote.fornecedores?.razao_social || '—'}</td>
                      <td className="px-5 py-4 text-right text-[14px] text-foreground">
                        {lote.custo_unitario
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lote.custo_unitario)
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}