'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Search, Loader2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formaPagamentoLabels, type FormaPagamento, type Produto } from '@/lib/supabase/types'
import { consumirFefo } from '@/lib/estoque/fefo'

interface ItemLinha {
  produto_id: string | null
  produto_nome: string
  quantidade: number
  valor_unitario: number
  saldo_atual?: number
}

const formasPagamento: FormaPagamento[] = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto', 'convenio', 'outros']

export default function NovaVendaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    data_venda: new Date().toISOString().split('T')[0],
    forma_pagamento: 'dinheiro' as FormaPagamento,
    observacao: '',
  })
  const [itens, setItens] = useState<ItemLinha[]>([
    { produto_id: null, produto_nome: '', quantidade: 1, valor_unitario: 0 },
  ])

  // Product search state (per-item)
  const [searchText, setSearchText] = useState<string[]>([''])
  const [searchResults, setSearchResults] = useState<Produto[][]>([[]])
  const [searching, setSearching] = useState<boolean[]>([false])
  const [showDropdown, setShowDropdown] = useState<boolean[]>([false])
  const searchRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    searchRefs.current = searchRefs.current.slice(0, itens.length)
  }, [itens.length])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      searchRefs.current.forEach((ref, idx) => {
        if (ref && !ref.contains(e.target as Node)) {
          setShowDropdown(prev => prev.map((v, k) => k === idx ? false : v))
        }
      })
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch(idx: number, term: string) {
    const newSearch = [...searchText]
    newSearch[idx] = term
    setSearchText(newSearch)

    if (term.length < 2) {
      setShowDropdown(prev => { const n = [...prev]; n[idx] = false; return n })
      return
    }

    setSearching(prev => { const n = [...prev]; n[idx] = true; return n })
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .or(`nome.ilike.%${term}%,nome_comercial.ilike.%${term}%,principio_ativo.ilike.%${term}%`)
      .eq('ativo', true)
      .order('nome')
      .limit(8)

    setSearchResults(prev => { const n = [...prev]; n[idx] = data || []; return n })
    setSearching(prev => { const n = [...prev]; n[idx] = false; return n })
    setShowDropdown(prev => { const n = [...prev]; n[idx] = true; return n })
  }

  function selectProduct(idx: number, produto: Produto) {
    const updated = [...itens]
    updated[idx] = {
      produto_id: produto.id,
      produto_nome: `${produto.nome}${produto.principio_ativo ? ` (${produto.principio_ativo})` : ''}`,
      quantidade: 1,
      valor_unitario: updated[idx].valor_unitario || 0,
      saldo_atual: produto.saldo_atual,
    }
    setItens(updated)
    setSearchText(prev => { const n = [...prev]; n[idx] = updated[idx].produto_nome; return n })
    setShowDropdown(prev => { const n = [...prev]; n[idx] = false; return n })
  }

  function clearProduct(idx: number) {
    const updated = [...itens]
    updated[idx] = { produto_id: null, produto_nome: searchText[idx], quantidade: updated[idx].quantidade, valor_unitario: updated[idx].valor_unitario }
    setItens(updated)
    setShowDropdown(prev => { const n = [...prev]; n[idx] = false; return n })
  }

  function addItem() {
    setItens([...itens, { produto_id: null, produto_nome: '', quantidade: 1, valor_unitario: 0 }])
    setSearchText([...searchText, ''])
    setSearchResults([...searchResults, []])
    setSearching([...searching, false])
    setShowDropdown([...showDropdown, false])
  }

  function removeItem(i: number) {
    if (itens.length === 1) return
    setItens(itens.filter((_, idx) => idx !== i))
    setSearchText(searchText.filter((_, idx) => idx !== i))
    setSearchResults(searchResults.filter((_, idx) => idx !== i))
    setSearching(searching.filter((_, idx) => idx !== i))
    setShowDropdown(showDropdown.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof ItemLinha, value: string | number) {
    const updated = [...itens]
    ;(updated[i] as any)[field] = value
    setItens(updated)
  }

  const valorTotal = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (itens.some(i => !i.produto_nome || i.valor_unitario <= 0)) {
      toast.error('Preencha todos os itens corretamente')
      return
    }
    if (valorTotal <= 0) {
      toast.error('Valor total deve ser maior que zero')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Criar venda
    const { data: venda, error } = await supabase
      .from('vendas')
      .insert({
        data_venda: form.data_venda,
        valor_total: valorTotal,
        forma_pagamento: form.forma_pagamento,
        usuario_id: user?.id,
        observacao: form.observacao || null,
      })
      .select()
      .single()

    if (error || !venda) {
      toast.error('Erro ao registrar venda: ' + (error?.message || 'unknown'))
      setSaving(false)
      return
    }

    // 2. Inserir itens
    const itensPayload = itens.map(item => ({
      venda_id: venda.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      subtotal: item.quantidade * item.valor_unitario,
    }))

    const { error: itensError } = await supabase.from('itens_venda').insert(itensPayload)
    if (itensError) {
      toast.error('Venda criada, mas erro nos itens: ' + itensError.message)
    }

    // 3. Dar baixa no estoque (FEFO) para cada item com produto vinculado
    const fefoErrors: string[] = []
    for (const item of itens) {
      if (!item.produto_id) continue // item sem produto (serviço) - não baixa estoque

      const result = await consumirFefo({
        produtoId: item.produto_id,
        quantidade: item.quantidade,
        usuarioId: user?.id || '',
      })

      if (!result.success) {
        fefoErrors.push(`${item.produto_nome}: ${result.error || 'sem estoque suficiente'}`)
      }
    }

    if (fefoErrors.length > 0) {
      toast.warning('Venda registrada, mas alguns itens sem estoque:\n' + fefoErrors.join('\n'))
    } else {
      const itensComProduto = itens.filter(i => i.produto_id).length
      if (itensComProduto > 0) {
        toast.success(`Venda registrada! ${itensComProduto} item(ns) deram baixa no estoque.`)
      } else {
        toast.success('Venda registrada com sucesso!')
      }
    }

    router.push('/dashboard/financeiro/vendas')
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/financeiro/vendas')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Nova Venda</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">Registrar venda com baixa automática no estoque</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dados da Venda */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-[15px] font-semibold text-foreground">Informações da Venda</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Data</Label>
              <Input type="date" value={form.data_venda} onChange={e => setForm({ ...form, data_venda: e.target.value })} required className="h-9 rounded-lg text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Forma de Pagamento</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px]"
                value={form.forma_pagamento}
                onChange={e => setForm({ ...form, forma_pagamento: e.target.value as FormaPagamento })}
              >
                {formasPagamento.map(fp => (
                  <option key={fp} value={fp}>{formaPagamentoLabels[fp]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Observação</Label>
            <Input
              placeholder="Observação (opcional)"
              value={form.observacao}
              onChange={e => setForm({ ...form, observacao: e.target.value })}
              className="h-9 rounded-lg text-[13px]"
            />
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-[15px] font-semibold text-foreground">Itens</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Item
            </button>
          </div>

          <div className="space-y-4">
            {itens.map((item, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                {/* Product selector */}
                <div className="min-w-[200px] flex-1 space-y-1" ref={el => { searchRefs.current[i] = el }}>
                  <Label className="text-[11px] text-muted-foreground/60">Produto</Label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                      <Input
                        placeholder="Buscar produto ou digitar serviço..."
                        value={searchText[i] ?? item.produto_nome}
                        onChange={e => {
                          const val = e.target.value
                          setSearchText(prev => { const n = [...prev]; n[i] = val; return n })
                          // Se mudou o texto, limpa o produto vinculado
                          if (item.produto_id && val !== item.produto_nome) {
                            const updated = [...itens]
                            updated[i] = { ...updated[i], produto_id: null, saldo_atual: undefined }
                            setItens(updated)
                          }
                          handleSearch(i, val)
                        }}
                        onFocus={() => {
                          if (searchText[i]?.length >= 2) setShowDropdown(prev => { const n = [...prev]; n[i] = true; return n })
                        }}
                        className="h-9 rounded-lg pl-8 pr-8 text-[13px]"
                      />
                      {searching[i] && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Dropdown results */}
                    {showDropdown[i] && searchResults[i]?.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card p-1 shadow-lg">
                        {searchResults[i].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProduct(i, p)}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors duration-100 hover:bg-muted"
                          >
                            <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">{p.nome}</span>
                              {p.principio_ativo && (
                                <span className="block truncate text-[11px] text-muted-foreground/60">{p.principio_ativo}</span>
                              )}
                            </div>
                            <span className={`shrink-0 text-[12px] font-medium ${(p.saldo_atual ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {p.saldo_atual} {p.unidade_medida}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Qty */}
                <div className="w-20 space-y-1">
                  <Label className="text-[11px] text-muted-foreground/60">Qtd</Label>
                  <Input
                    type="number" min="1"
                    value={item.quantidade}
                    onChange={e => updateItem(i, 'quantidade', parseInt(e.target.value) || 1)}
                    required
                    className="h-9 rounded-lg text-[13px]"
                  />
                </div>

                {/* Unit price */}
                <div className="w-28 space-y-1">
                  <Label className="text-[11px] text-muted-foreground/60">Valor Unit.</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    placeholder="0,00"
                    value={item.valor_unitario}
                    onChange={e => updateItem(i, 'valor_unitario', parseFloat(e.target.value) || 0)}
                    required
                    className="h-9 rounded-lg text-[13px]"
                  />
                </div>

                {/* Subtotal */}
                <div className="w-24 space-y-1">
                  <Label className="text-[11px] text-muted-foreground/60">Subtotal</Label>
                  <div className="flex h-9 items-center rounded-lg border border-transparent text-[13px] font-medium text-foreground">
                    R$ {(item.quantidade * item.valor_unitario).toFixed(2)}
                  </div>
                </div>

                {/* Estoque indicator */}
                {item.produto_id && (
                  <div className="w-16 space-y-1">
                    <Label className="text-[11px] text-muted-foreground/60">Estoque</Label>
                    <div className={`flex h-9 items-center rounded-lg border border-transparent text-[12px] font-medium ${(item.saldo_atual ?? 0) >= item.quantidade ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {item.saldo_atual ?? '—'}
                    </div>
                  </div>
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  disabled={itens.length === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/30 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end border-t border-border/40 pt-4">
            <div className="text-right">
              <p className="text-[12px] text-muted-foreground/60">Valor Total</p>
              <p className="font-heading text-[22px] font-bold tracking-tight text-foreground">
                R$ {valorTotal.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/financeiro/vendas')}
            className="h-10 rounded-xl border border-border bg-card px-5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted"
          >
            Cancelar
          </button>
          <Button
            type="submit"
            disabled={saving}
            className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {saving ? 'Salvando...' : 'Registrar Venda'}
          </Button>
        </div>
      </form>
    </div>
  )
}