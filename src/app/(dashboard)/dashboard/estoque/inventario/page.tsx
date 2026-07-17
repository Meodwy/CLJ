'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Search, Loader2, X, ClipboardCheck, Package, Plus, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import type { Produto, Inventario, Profile, Lote } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR')
}

export default function InventarioPage() {
  const { profile } = useAuth()
  const [mount, setMount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [inventarios, setInventarios] = useState<(Inventario & { produtos?: Produto; profiles?: Profile })[]>([])
  const [search, setSearch] = useState('')
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null)
  const [quantidadeFisica, setQuantidadeFisica] = useState<number>(0)
  const [observacao, setObservacao] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [lotesProduto, setLotesProduto] = useState<Lote[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const [pRes, iRes] = await Promise.all([
          supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
          supabase.from('inventarios').select('*, produtos(*), profiles(*)').order('created_at', { ascending: false }).limit(20),
        ])
        if (pRes.data) setProdutos(pRes.data)
        if (iRes.data) setInventarios(iRes.data)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredProdutos = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return produtos
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.codigo_barras && p.codigo_barras.includes(q))
    )
  }, [produtos, search])

  const selectProduto = async (produto: Produto) => {
    setSelectedProduto(produto)
    setQuantidadeFisica(produto.saldo_atual)
    setObservacao('')
    setShowForm(true)
    setSearch('')

    try {
      const { data } = await createClient()
        .from('lotes')
        .select('*')
        .eq('produto_id', produto.id)
        .gt('quantidade_disponivel', 0)
        .order('data_validade', { ascending: true })
      if (data) setLotesProduto(data)
    } catch (err) {
      console.error('Erro ao carregar lotes:', err)
    }
  }

  const handleSubmit = async () => {
    if (!selectedProduto) return
    setSubmitting(true)

    try {
      const supabase = createClient()
      const quantidadeSistema = selectedProduto.saldo_atual
      const diferenca = quantidadeFisica - quantidadeSistema

      // INSERT inventario
      const { error } = await supabase
        .from('inventarios')
        .insert({
          produto_id: selectedProduto.id,
          quantidade_sistema: quantidadeSistema,
          quantidade_fisica: quantidadeFisica,
          diferenca: diferenca,
          usuario_id: profile?.id || null,
          observacao: observacao || null,
        })

      if (error) {
        toast.error('Erro ao registrar inventário')
        console.error(error)
        setSubmitting(false)
        return
      }

      // If there's a difference, update stock and create adjustment
      if (diferenca !== 0) {
        // Update product stock
        const { error: updateError } = await supabase
          .from('produtos')
          .update({ saldo_atual: quantidadeFisica })
          .eq('id', selectedProduto.id)

        if (updateError) {
          console.error('Erro ao atualizar saldo:', updateError)
        }

        // Update local state
        setProdutos(prev => prev.map(p =>
          p.id === selectedProduto.id ? { ...p, saldo_atual: quantidadeFisica } : p
        ))

        // Create movement log
        await supabase
          .from('movimentacoes')
          .insert({
            produto_id: selectedProduto.id,
            tipo_movimentacao: 'ajuste',
            quantidade: Math.abs(diferenca),
            usuario_id: profile?.id || null,
            observacao: `Ajuste de inventário: ${diferenca > 0 ? '+' : ''}${diferenca} unidades (físico: ${quantidadeFisica}, sistema: ${quantidadeSistema})`,
          })
      }

      toast.success(`Inventário registrado${diferenca !== 0 ? ` com diferença de ${diferenca > 0 ? '+' : ''}${diferenca} unidades` : ''}`)
      setShowForm(false)
      setSelectedProduto(null)

      // Reload inventarios
      const { data } = await supabase
        .from('inventarios')
        .select('*, produtos(*), profiles(*)')
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setInventarios(data)

    } catch (err) {
      console.error('Erro ao processar inventário:', err)
      toast.error('Erro ao processar inventário')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteInventario = async (id: string, produtoNome: string) => {
    if (!confirm(`Excluir inventário de "${produtoNome}"? Esta ação não pode ser desfeita.`)) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from('inventarios').delete().eq('id', id)
      if (error) throw error

      toast.success('Inventário excluído')
      setInventarios(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir inventário')
    }
  }

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Inventário</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${produtos.length} produto${produtos.length !== 1 ? 's' : ''} cadastrado${produtos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}
            className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97]">
            <Plus className="mr-1.5 h-4 w-4" />Novo Inventário
          </Button>
        )}
      </div>

      {showForm ? (
        /* New inventory form */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Novo Inventário</CardTitle>
              <CardDescription>Selecione um produto e informe a quantidade física</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Product selector */}
              {!selectedProduto && (
                <div className="space-y-3">
                  <Label className="text-[13px] font-medium text-foreground/80">Produto</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
                    <input ref={inputRef} placeholder="Buscar produto…" value={search} onChange={e => setSearch(e.target.value)}
                      className="h-[46px] w-full rounded-xl border border-border bg-card pl-10 pr-4 text-[15px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-border">
                    {filteredProdutos.length === 0 ? (
                      <p className="p-4 text-center text-[14px] text-muted-foreground/60">Nenhum produto encontrado</p>
                    ) : (
                      filteredProdutos.map(p => (
                        <button key={p.id} type="button" onClick={() => selectProduto(p)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/40 border-b border-border/50 last:border-b-0">
                          <div>
                            <span className="text-[14px] font-medium text-foreground">{p.nome}</span>
                            {p.sku && <span className="ml-2 text-[12px] text-muted-foreground/50">{p.sku}</span>}
                          </div>
                          <span className="text-[13px] text-muted-foreground">Saldo: {p.saldo_atual}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Selected product info */}
              {selectedProduto && (
                <>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[15px] font-medium text-foreground">{selectedProduto.nome}</p>
                        {selectedProduto.sku && <p className="text-[13px] text-muted-foreground">SKU: {selectedProduto.sku}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedProduto(null); setLotesProduto([]) }}
                        className="h-8 rounded-lg text-[12px]">Trocar</Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border/50 pt-3">
                      <div>
                        <span className="text-[12px] text-muted-foreground/60">Saldo no Sistema</span>
                        <p className="text-[18px] font-semibold text-foreground">{selectedProduto.saldo_atual}</p>
                      </div>
                      <div>
                        <span className="text-[12px] text-muted-foreground/60">Unidade</span>
                        <p className="text-[18px] font-semibold text-foreground">{selectedProduto.unidade_medida}</p>
                      </div>
                    </div>

                    {/* Lotes info */}
                    {lotesProduto.length > 0 && (
                      <div className="mt-3 border-t border-border/50 pt-3">
                        <p className="text-[12px] text-muted-foreground/60 mb-2">Lotes com estoque:</p>
                        {lotesProduto.map(l => (
                          <div key={l.id} className="flex items-center justify-between text-[13px] py-1">
                            <span className="text-muted-foreground">Lote {l.numero_lote}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">Vence: {formatDate(l.data_validade)}</span>
                              <span className="font-medium text-foreground">{l.quantidade_disponivel}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Physical count input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="qtdFisica" className="text-[13px] font-medium text-foreground/80">Quantidade Física (contagem manual)</Label>
                    <Input id="qtdFisica" type="number" min={0} value={quantidadeFisica}
                      onChange={e => setQuantidadeFisica(parseInt(e.target.value) || 0)}
                      disabled={submitting}
                      className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                  </div>

                  {/* Difference preview */}
                  {selectedProduto && (
                    <div className={`rounded-xl border p-4 ${quantidadeFisica !== selectedProduto.saldo_atual ? 'border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20' : 'border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20'}`}>
                      <div className="flex items-center gap-2">
                        {quantidadeFisica !== selectedProduto.saldo_atual ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="text-[14px] font-medium text-foreground">
                            {quantidadeFisica !== selectedProduto.saldo_atual ? 'Diferença Detectada' : 'Estoque OK'}
                          </p>
                          <p className="text-[13px] text-muted-foreground">
                            Sistema: {selectedProduto.saldo_atual} | Físico: {quantidadeFisica} | Diferença:{' '}
                            <span className={quantidadeFisica > selectedProduto.saldo_atual ? 'text-green-600 font-medium' : quantidadeFisica < selectedProduto.saldo_atual ? 'text-red-600 font-medium' : ''}>
                              {quantidadeFisica - selectedProduto.saldo_atual > 0 ? '+' : ''}{quantidadeFisica - selectedProduto.saldo_atual}
                            </span>
                          </p>
                          {quantidadeFisica !== selectedProduto.saldo_atual && (
                            <p className="text-[12px] text-muted-foreground/70 mt-1">
                              Uma movimentação de ajuste será criada automaticamente
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observação */}
                  <div className="space-y-1.5">
                    <Label htmlFor="obs" className="text-[13px] font-medium text-foreground/80">Observação</Label>
                    <textarea id="obs" value={observacao} onChange={e => setObservacao(e.target.value)}
                      placeholder="Observações sobre a contagem..." disabled={submitting} rows={2}
                      className="h-[46px] w-full rounded-xl border border-border/80 bg-card px-4 py-3 text-[15px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] resize-none disabled:opacity-50" />
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="button" onClick={handleSubmit}
                      className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]"
                      disabled={submitting}>
                      {submitting ? (
                        <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Salvando...</>
                      ) : (
                        <><ClipboardCheck className="mr-2 h-[18px] w-[18px]" />Registrar Inventário</>
                      )}
                    </Button>
                    <Button type="button" variant="outline" className="h-[46px] rounded-xl text-[15px]"
                      onClick={() => { setShowForm(false); setSelectedProduto(null); setLotesProduto([]) }} disabled={submitting}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Search when not in form */
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
          <input ref={inputRef} placeholder="Buscar produtos para inventário…" value={search} onChange={e => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 6%, transparent)]" />
          {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        </div>
      )}

      {/* Recent inventories history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground/50" />
            Últimos Inventários
          </CardTitle>
          <CardDescription>Histórico dos 20 inventários mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" /></div>
          ) : inventarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/20" />
              <p className="mt-3 text-[14px] text-muted-foreground/60">Nenhum inventário registrado ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Data</th>
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Produto</th>
                    <th className="px-4 py-3 text-right text-[13px] font-medium text-muted-foreground/70">Sistema</th>
                    <th className="px-4 py-3 text-right text-[13px] font-medium text-muted-foreground/70">Físico</th>
                    <th className="px-4 py-3 text-right text-[13px] font-medium text-muted-foreground/70">Diferença</th>
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Usuário</th>
                    {profile?.role === 'administrador' && <th className="px-4 py-3 text-right text-[13px] font-medium text-muted-foreground/70">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventarios.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-b-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/20">
                      <td className="px-4 py-3 text-[14px] text-muted-foreground whitespace-nowrap">{formatDateTime(inv.created_at)}</td>
                      <td className="px-4 py-3 text-[14px] font-medium text-foreground">{inv.produtos?.nome || '—'}</td>
                      <td className="px-4 py-3 text-right text-[14px] text-foreground">{inv.quantidade_sistema}</td>
                      <td className="px-4 py-3 text-right text-[14px] text-foreground">{inv.quantidade_fisica}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[14px] font-medium ${
                          inv.diferenca > 0 ? 'text-green-600 dark:text-green-400' :
                          inv.diferenca < 0 ? 'text-red-600 dark:text-red-400' :
                          'text-muted-foreground'
                        }`}>
                          {inv.diferenca > 0 ? '+' : ''}{inv.diferenca}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] text-muted-foreground">{inv.profiles?.nome || '—'}</td>
                      {profile?.role === 'administrador' && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteInventario(inv.id, inv.produtos?.nome || '')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}