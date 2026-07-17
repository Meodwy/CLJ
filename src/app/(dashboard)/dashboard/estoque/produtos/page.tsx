'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, Package, X, AlertTriangle, CheckCircle, ChevronRight, Barcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Produto } from '@/lib/supabase/types'

export default function ProdutosListPage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<(Produto & { categorias?: { nome: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mount, setMount] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('produtos')
          .select('*, categorias ( nome )')
          .eq('ativo', true)
          .order('nome')
        if (data) setProdutos(data)
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return produtos
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [produtos, search])

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Produtos</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${produtos.length} produto${produtos.length !== 1 ? 's' : ''} cadastrado${produtos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/estoque/produtos/novo')}
          className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 hover:brightness-110 active:scale-[0.97]">
          <Plus className="mr-1.5 h-4 w-4" />Novo Produto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
        <input ref={inputRef} placeholder="Buscar por nome, código de barras ou SKU…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
        {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        {!loading && search && <p className="mt-1.5 text-[13px] text-muted-foreground/60">{filtered.length} de {produtos.length}</p>}
      </div>

      {/* Grid / States */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20"><Package className="h-7 w-7 text-blue-500 dark:text-blue-400" /></div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhum produto ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">Cadastre o primeiro produto para começar</p>
          <Button onClick={() => router.push('/dashboard/estoque/produtos/novo')} className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium">
            <Plus className="mr-1.5 h-4 w-4" />Cadastrar
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => {
            const isBelowMin = p.estoque_minimo > 0 && p.saldo_atual <= p.estoque_minimo
            return (
              <button key={p.id} onClick={() => router.push(`/dashboard/estoque/produtos/${p.id}`)}
                className={`group relative rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.98] ${!mount ? 'opacity-0' : ''}`}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  {isBelowMin ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />Crítico
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" />Normal
                    </span>
                  )}
                </div>
                {/* Name and category */}
                <p className="text-[14px] font-medium text-foreground truncate">{p.nome}</p>
                {p.categorias?.nome && (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{p.categorias.nome}</p>
                )}
                {/* Stock info */}
                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground/70">
                    Saldo: <strong className="text-foreground">{p.saldo_atual}</strong>
                  </span>
                  <span className="text-muted-foreground/70">
                    Mín: <strong className="text-foreground">{p.estoque_minimo}</strong>
                  </span>
                </div>
                {p.codigo_barras && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/50">
                    <Barcode className="h-3 w-3" />{p.codigo_barras}
                  </div>
                )}
                <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/20 transition-colors duration-150 ease-[var(--ease-out)] group-hover:text-primary/60" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}