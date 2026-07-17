'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Plus, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import type { Fornecedor, Produto } from '@/lib/supabase/types'

interface ItemForm {
  produtoId: string
  produtoNome: string
  quantidade: number
  valorUnitario: number
  numeroLote: string
  dataFabricacao: string
  dataValidade: string
  registroAnvisa: string
}

export default function NovaCompraPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [mount, setMount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [fornecedorId, setFornecedorId] = useState('')
  const [numeroNota, setNumeroNota] = useState('')
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0])
  const [observacao, setObservacao] = useState('')
  const [items, setItems] = useState<ItemForm[]>([
    { produtoId: '', produtoNome: '', quantidade: 1, valorUnitario: 0, numeroLote: '', dataFabricacao: '', dataValidade: '', registroAnvisa: '' }
  ])

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const [fRes, pRes] = await Promise.all([
          supabase.from('fornecedores').select('*').eq('ativo', true).order('razao_social'),
          supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
        ])
        if (fRes.data) setFornecedores(fRes.data)
        if (pRes.data) setProdutos(pRes.data)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      }
    }
    load()
  }, [])

  const addItem = () => {
    setItems(prev => [...prev, { produtoId: '', produtoNome: '', quantidade: 1, valorUnitario: 0, numeroLote: '', dataFabricacao: '', dataValidade: '', registroAnvisa: '' }])
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      if (field === 'produtoId') {
        const produto = produtos.find(p => p.id === value)
        updated[index] = { ...updated[index], produtoId: value as string, produtoNome: produto?.nome || '' }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      // Validate items
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item.produtoId) {
          toast.error(`Item ${i + 1}: selecione um produto`)
          setLoading(false)
          return
        }
        if (item.quantidade <= 0) {
          toast.error(`Item ${i + 1}: quantidade deve ser maior que zero`)
          setLoading(false)
          return
        }
        if (!item.dataValidade) {
          toast.error(`Item ${i + 1}: data de validade é obrigatória`)
          setLoading(false)
          return
        }
      }

      // 1. INSERT compra
      const valorTotal = items.reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0)
      const { data: compra, error: compraError } = await supabase
        .from('compras')
        .insert({
          fornecedor_id: fornecedorId || null,
          numero_nota: numeroNota || null,
          data_compra: dataCompra,
          valor_total: valorTotal || null,
          usuario_id: profile?.id || null,
          observacao: observacao || null,
        })
        .select()
        .single()

      if (compraError) {
        toast.error('Erro ao criar compra')
        console.error(compraError)
        setLoading(false)
        return
      }

      const compraId = compra.id

      // 2. For each item: INSERT lote, itens_compra, movimentacao
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const loteNumero = item.numeroLote || `COMP-${compraId.slice(0, 8)}-${i + 1}`

        // INSERT lote
        const { data: lote, error: loteError } = await supabase
          .from('lotes')
          .insert({
            produto_id: item.produtoId,
            numero_lote: loteNumero,
            data_fabricacao: item.dataFabricacao || null,
            data_validade: item.dataValidade,
            quantidade_recebida: item.quantidade,
            quantidade_disponivel: item.quantidade,
            custo_unitario: item.valorUnitario || null,
            fornecedor_id: fornecedorId || null,
            nota_fiscal: numeroNota || null,
            usuario_id: profile?.id || null,
            registro_anvisa: item.registroAnvisa.trim() || null,
          })
          .select()
          .single()

        if (loteError) {
          toast.error(`Erro ao criar lote para item ${i + 1}`)
          console.error(loteError)
          setLoading(false)
          return
        }

        // INSERT itens_compra
        const { error: itemError } = await supabase
          .from('itens_compra')
          .insert({
            compra_id: compraId,
            produto_id: item.produtoId,
            lote_id: lote.id,
            quantidade: item.quantidade,
            valor_unitario: item.valorUnitario || null,
            subtotal: item.quantidade * item.valorUnitario || null,
          })

        if (itemError) {
          toast.error(`Erro ao registrar item ${i + 1}`)
          console.error(itemError)
          setLoading(false)
          return
        }

        // INSERT movimentacao entrada
        const { error: movError } = await supabase
          .from('movimentacoes')
          .insert({
            produto_id: item.produtoId,
            lote_id: lote.id,
            tipo_movimentacao: 'entrada',
            quantidade: item.quantidade,
            usuario_id: profile?.id || null,
            observacao: `Compra ${numeroNota || compraId.slice(0, 8)} - Lote ${loteNumero}`,
          })

        if (movError) {
          console.error('Erro ao registrar movimentação:', movError)
        }
      }

      toast.success('Compra registrada com sucesso!')
      router.push('/dashboard/estoque/compras')
    } catch (err) {
      console.error('Erro ao processar compra:', err)
      toast.error('Erro ao processar compra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`mx-auto max-w-4xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Nova Compra</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Registre uma nova compra com entrada de estoque</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Dados da Compra</CardTitle>
            <CardDescription>Informações gerais da compra</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Fornecedor */}
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor" className="text-[13px] font-medium text-foreground/80">Fornecedor</Label>
              <select
                id="fornecedor"
                value={fornecedorId}
                onChange={e => setFornecedorId(e.target.value)}
                disabled={loading}
                className="h-[46px] w-full rounded-xl border border-border/80 bg-card px-4 text-[15px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] disabled:opacity-50"
              >
                <option value="">Selecione um fornecedor</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                ))}
              </select>
            </div>

            {/* Número nota + Data */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="numeroNota" className="text-[13px] font-medium text-foreground/80">Número da Nota</Label>
                <Input id="numeroNota" value={numeroNota} onChange={e => setNumeroNota(e.target.value)}
                  placeholder="Ex: 123456" disabled={loading}
                  className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataCompra" className="text-[13px] font-medium text-foreground/80">Data da Compra</Label>
                <Input id="dataCompra" type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)}
                  disabled={loading}
                  className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
              </div>
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <Label htmlFor="observacao" className="text-[13px] font-medium text-foreground/80">Observação</Label>
              <textarea id="observacao" value={observacao} onChange={e => setObservacao(e.target.value)}
                placeholder="Observações sobre a compra..." disabled={loading} rows={2}
                className="h-[46px] w-full rounded-xl border border-border/80 bg-card px-4 py-3 text-[15px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] resize-none disabled:opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Itens da Compra</h2>
              <p className="text-[13px] text-muted-foreground">Adicione os produtos adquiridos</p>
            </div>
            <Button type="button" variant="outline" onClick={addItem} disabled={loading}
              className="h-10 rounded-xl text-[13px]">
              <Plus className="mr-1.5 h-4 w-4" />Adicionar Item
            </Button>
          </div>

          {items.map((item, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-[14px] font-medium text-foreground">Item {index + 1}</span>
                  </div>
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}
                      disabled={loading} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Select Produto */}
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Produto</Label>
                    <select
                      value={item.produtoId}
                      onChange={e => updateItem(index, 'produtoId', e.target.value)}
                      disabled={loading}
                      className="h-[46px] w-full rounded-xl border border-border/80 bg-card px-4 text-[15px] text-foreground outline-none transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] disabled:opacity-50"
                    >
                      <option value="">Selecione um produto</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome} ({p.sku || p.unidade_medida})</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantidade + Valor Unitário */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">Quantidade</Label>
                      <Input type="number" min={1} value={item.quantidade}
                        onChange={e => updateItem(index, 'quantidade', parseInt(e.target.value) || 0)}
                        disabled={loading}
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">Valor Unitário (R$)</Label>
                      <Input type="number" min={0} step={0.01} value={item.valorUnitario}
                        onChange={e => updateItem(index, 'valorUnitario', parseFloat(e.target.value) || 0)}
                        disabled={loading} placeholder="0,00"
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                  </div>

                  {/* Lote */}
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">Nº Lote</Label>
                      <Input value={item.numeroLote}
                        onChange={e => updateItem(index, 'numeroLote', e.target.value)}
                        disabled={loading} placeholder="Auto ou manual"
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">Data Fabricação</Label>
                      <Input type="date" value={item.dataFabricacao}
                        onChange={e => updateItem(index, 'dataFabricacao', e.target.value)}
                        disabled={loading}
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">
                        Data Validade <span className="text-destructive">*</span>
                      </Label>
                      <Input type="date" value={item.dataValidade}
                        onChange={e => updateItem(index, 'dataValidade', e.target.value)}
                        disabled={loading} required
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-foreground/80">Registro ANVISA</Label>
                      <Input value={item.registroAnvisa}
                        onChange={e => updateItem(index, 'registroAnvisa', e.target.value)}
                        disabled={loading} placeholder="Registro do lote"
                        className="h-[46px] rounded-xl border-border/80 px-4 text-[15px]" />
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-4">
                    <span className="text-[13px] text-muted-foreground">Subtotal</span>
                    <span className="text-[15px] font-medium text-foreground">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantidade * item.valorUnitario)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-8 flex items-center gap-3 pb-8">
          <Button type="submit" className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]"
            disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Registrando...</>
            ) : (
              <><Plus className="mr-2 h-[18px] w-[18px]" />Registrar Compra</>
            )}
          </Button>
          <Button type="button" variant="outline" className="h-[46px] rounded-xl text-[15px]"
            onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}