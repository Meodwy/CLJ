'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Package, Edit, Loader2, Calendar, Barcode, Hash, Building2, Tag, FlaskConical, Ruler, AlertTriangle, CheckCircle, Layers, ArrowRight, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useBreadcrumbLabel } from '@/contexts/breadcrumb-context'
import type { Lote, Movimentacao } from '@/lib/supabase/types'

interface ProdutoDetalhes {
  id: string
  nome: string
  nome_comercial: string | null
  principio_ativo: string | null
  categoria_id: string | null
  subcategoria: string | null
  fabricante: string | null
  codigo_barras: string | null
  sku: string | null
  registro_anvisa: string | null
  unidade_medida: string
  quantidade_por_embalagem: number
  estoque_minimo: number
  estoque_maximo: number | null
  saldo_atual: number
  ativo: boolean
  created_at: string
  updated_at: string
  categorias: { id: string; nome: string } | null
}

export default function ProdutoDetalhesPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { setDynamicLabel } = useBreadcrumbLabel()
  const [produto, setProduto] = useState<ProdutoDetalhes | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [expandedMov, setExpandedMov] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mount, setMount] = useState(false)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()

        const { data: prod, error } = await supabase
          .from('produtos')
          .select('*, categorias ( id, nome )')
          .eq('id', params.id)
          .single()

        if (error || !prod) {
          toast.error('Produto não encontrado')
          router.push('/dashboard/estoque/produtos')
          return
        }

        setProduto(prod)

        const { data: lotesData } = await supabase
          .from('lotes')
          .select('*')
          .eq('produto_id', params.id)
          .order('data_validade', { ascending: true })

        if (lotesData) setLotes(lotesData)

        const { data: movData } = await supabase
          .from('movimentacoes')
          .select('*, lotes(numero_lote)')
          .eq('produto_id', params.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (movData) setMovimentacoes(movData)
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar produto')
        router.push('/dashboard/estoque/produtos')
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  useEffect(() => {
    if (produto?.nome) setDynamicLabel(produto.nome)
    return () => setDynamicLabel(null)
  }, [produto, setDynamicLabel])

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja desativar este produto?')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', params.id)
      if (error) throw error
      toast.success('Produto desativado')
      router.push('/dashboard/estoque/produtos')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao desativar produto')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!produto) return null

  const isBelowMin = produto.estoque_minimo > 0 && produto.saldo_atual <= produto.estoque_minimo

  const infoFields = [
    { label: 'Nome Comercial', value: produto.nome_comercial, icon: Tag },
    { label: 'Princípio Ativo', value: produto.principio_ativo, icon: FlaskConical },
    { label: 'Categoria', value: produto.categorias?.nome, icon: Package },
    { label: 'Subcategoria', value: produto.subcategoria, icon: Package },
    { label: 'Fabricante', value: produto.fabricante, icon: Building2 },
    { label: 'Código de Barras', value: produto.codigo_barras, icon: Barcode },
    { label: 'SKU', value: produto.sku, icon: Hash },
    { label: 'Registro ANVISA', value: produto.registro_anvisa, icon: FileIcon },
    { label: 'Unidade de Medida', value: unidadeLabel(produto.unidade_medida), icon: Ruler },
    { label: 'Qtd por Embalagem', value: String(produto.quantidade_por_embalagem), icon: Layers },
    { label: 'Estoque Mínimo', value: String(produto.estoque_minimo), icon: AlertTriangle },
    { label: 'Estoque Máximo', value: produto.estoque_maximo ? String(produto.estoque_maximo) : '—', icon: ArrowRight },
  ]

  return (
    <div className={`mx-auto max-w-4xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-xl font-medium text-foreground">{produto.nome}</h1>
            <p className="text-sm text-muted-foreground">Detalhes do produto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push(`/dashboard/estoque/produtos/${params.id}/editar`)}
            className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm">
            <Edit className="mr-1.5 h-4 w-4" />Editar
          </Button>
          <Button variant="outline" onClick={handleDelete}
            className="h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive px-3">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status + Saldo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[13px] text-muted-foreground">Saldo Atual</p>
          <p className={`mt-1 text-[28px] font-bold ${isBelowMin ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {produto.saldo_atual}
          </p>
          <p className="text-[12px] text-muted-foreground/70">{produto.unidade_medida}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[13px] text-muted-foreground">Status</p>
          <div className="mt-2 flex items-center gap-2">
            {isBelowMin ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-[15px] font-semibold text-amber-600 dark:text-amber-400">Abaixo do Mínimo</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-[15px] font-semibold text-emerald-600 dark:text-emerald-400">Normal</span>
              </>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[13px] text-muted-foreground">Cadastrado em</p>
          <p className="mt-1 text-[15px] font-semibold text-foreground">
            {new Date(produto.created_at).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-[12px] text-muted-foreground/70">
            Atualizado em {new Date(produto.updated_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Info Fields */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Informações do Produto</h2>
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {infoFields.map(field => (
            <div key={field.label} className="flex items-center gap-3">
              <field.icon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground/60">{field.label}</p>
                <p className="text-[14px] text-foreground">{field.value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lotes Section */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Lotes ({lotes.length})</h2>
        {lotes.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <Layers className="h-8 w-8 text-muted-foreground/20" />
            <p className="mt-2 text-[13px] text-muted-foreground/60">Nenhum lote cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground/60">
                  <th className="pb-2 font-medium">Lote</th>
                  <th className="pb-2 font-medium">Validade</th>
                  <th className="pb-2 font-medium">Recebido</th>
                  <th className="pb-2 font-medium">Disponível</th>
                  <th className="pb-2 font-medium">Nº ANVISA</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map(lote => {
                  const vencido = new Date(lote.data_validade) < new Date()
                  const vencendo = !vencido && new Date(lote.data_validade) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  return (
                    <tr key={lote.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 text-foreground">{lote.numero_lote}</td>
                      <td className={`py-2.5 ${vencido ? 'text-destructive' : vencendo ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                        {new Date(lote.data_validade).toLocaleDateString('pt-BR')}
                        {vencido && <span className="ml-1.5 text-[11px]">(Vencido)</span>}
                        {vencendo && <span className="ml-1.5 text-[11px]">(Vencendo)</span>}
                      </td>
                      <td className="py-2.5 text-foreground">{lote.quantidade_recebida}</td>
                      <td className="py-2.5 text-foreground">{lote.quantidade_disponivel}</td>
                      <td className="py-2.5 text-foreground">{lote.registro_anvisa || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movimentações Section */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Últimas Movimentações</h2>
        {movimentacoes.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <ArrowRight className="h-8 w-8 text-muted-foreground/20" />
            <p className="mt-2 text-[13px] text-muted-foreground/60">Nenhuma movimentação registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {movimentacoes.map(mov => (
              <div key={mov.id}>
                <div
                  className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedMov(expandedMov === mov.id ? null : mov.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold ${
                      mov.tipo_movimentacao === 'entrada' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                      mov.tipo_movimentacao === 'saida' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}>
                      {mov.tipo_movimentacao === 'entrada' ? 'E' : mov.tipo_movimentacao === 'saida' ? 'S' : 'A'}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground capitalize">{mov.tipo_movimentacao}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {mov.lotes?.numero_lote ? `Lote: ${mov.lotes.numero_lote}` : 'Sem lote'}
                        {mov.observacao ? ' · clique para detalhes' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13px] font-semibold ${mov.tipo_movimentacao === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : mov.tipo_movimentacao === 'saida' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {mov.tipo_movimentacao === 'entrada' ? '+' : mov.tipo_movimentacao === 'saida' ? '-' : '±'}{mov.quantidade}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">{new Date(mov.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {expandedMov === mov.id && mov.observacao && (
                  <div className="mx-4 mt-1 mb-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground border border-border/30">
                    {mov.observacao}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function unidadeLabel(value: string) {
  const map: Record<string, string> = {
    un: 'Unidade (un)', cx: 'Caixa (cx)', fr: 'Frasco (fr)',
    ml: 'Mililitro (ml)', g: 'Grama (g)', mg: 'Miligrama (mg)',
    comp: 'Comprimido (comp)', amp: 'Ampola (amp)',
  }
  return map[value] || value
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}