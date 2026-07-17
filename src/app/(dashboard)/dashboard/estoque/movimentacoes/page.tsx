'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Search, Loader2, X, Clock, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Movimentacao, Produto, Lote, Profile, Fornecedor } from '@/lib/supabase/types'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR')
}

const tipoBadge: Record<string, { label: string; color: string }> = {
  entrada: { label: 'Entrada', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900/30' },
  saida: { label: 'Saída', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-900/30' },
  ajuste: { label: 'Ajuste', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/30' },
  transferencia: { label: 'Transferência', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/30' },
  perda: { label: 'Perda', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-900/30' },
  descarte: { label: 'Descarte', color: 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-900/30' },
}

const tipos = Object.keys(tipoBadge)

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<(Movimentacao & { produtos?: Produto; lotes?: Lote & { fornecedores?: Fornecedor }; profiles?: Profile })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [mount, setMount] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await createClient()
          .from('movimentacoes')
          .select('*, produtos(*), lotes(*, fornecedores(*)), profiles(*)')
          .order('created_at', { ascending: false })
        if (data) setMovimentacoes(data)
      } catch (err) {
        console.error('Erro ao carregar movimentações:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movimentacoes.filter(m => {
      if (tipoFilter && m.tipo_movimentacao !== tipoFilter) return false
      if (!q) return true
      return (
        (m.produtos?.nome?.toLowerCase().includes(q)) ||
        (m.lotes?.numero_lote?.toLowerCase().includes(q)) ||
        (m.observacao?.toLowerCase().includes(q)) ||
        (m.profiles?.nome?.toLowerCase().includes(q)) ||
        (m.lotes?.fornecedores?.nome_fantasia?.toLowerCase().includes(q)) ||
        (m.lotes?.fornecedores?.razao_social?.toLowerCase().includes(q))
      )
    })
  }, [movimentacoes, search, tipoFilter])

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Movimentações</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${movimentacoes.length} movimentação${movimentacoes.length !== 1 ? 'ões' : ''} registrada${movimentacoes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
          <input ref={inputRef} placeholder="Buscar por produto, lote ou observação…" value={search} onChange={e => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
          {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        </div>

        {/* Tipo filter */}
        <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
          className="h-11 rounded-xl border border-border bg-card px-4 text-[14px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]">
          <option value="">Todos os tipos</option>
          {tipos.map(t => (
            <option key={t} value={t}>{tipoBadge[t].label}</option>
          ))}
        </select>
      </div>

      {!loading && search && (
        <p className="text-[13px] text-muted-foreground/60">{filtered.length} de {movimentacoes.length}</p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : movimentacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20"><Clock className="h-7 w-7 text-blue-500 dark:text-blue-400" /></div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhuma movimentação ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">As movimentações são geradas automaticamente por compras, vendas e ajustes</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground/30" /></div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Nenhum resultado</h3>
          <p className="text-[14px] text-muted-foreground">Tente ajustar os filtros</p>
          <Button variant="outline" onClick={() => { setSearch(''); setTipoFilter('') }} className="mt-5 h-9 rounded-xl text-[13px]">Limpar filtros</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Data</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Produto</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Lote</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Fornecedor</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Tipo</th>
                  <th className="px-5 py-3.5 text-right text-[13px] font-medium text-muted-foreground/70">Quantidade</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Usuário</th>
                  <th className="px-5 py-3.5 text-left text-[13px] font-medium text-muted-foreground/70">Observação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const badge = tipoBadge[m.tipo_movimentacao] || { label: m.tipo_movimentacao, color: 'bg-muted text-muted-foreground border-border' }
                  return (
                    <tr key={m.id} className="border-b border-border/50 last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/20">
                      <td className="px-5 py-4 text-[14px] text-muted-foreground whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                      <td className="px-5 py-4 text-[14px] font-medium text-foreground">{m.produtos?.nome || '—'}</td>
                      <td className="px-5 py-4 text-[14px] text-muted-foreground">{m.lotes?.numero_lote || '—'}</td>
                      <td className="px-5 py-4 text-[14px] text-muted-foreground">
                        {m.lotes?.fornecedores ? (m.lotes.fornecedores.nome_fantasia || m.lotes.fornecedores.razao_social) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-[14px] font-medium text-foreground">{m.quantidade}</td>
                      <td className="px-5 py-4 text-[14px] text-muted-foreground">{m.profiles?.nome || '—'}</td>
                      <td className="px-5 py-4 text-[14px] text-muted-foreground max-w-[200px] truncate">{m.observacao || '—'}</td>
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