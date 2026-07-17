'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBreadcrumbLabel } from '@/contexts/breadcrumb-context'
import { useAuth } from '@/contexts/auth-context'
import { ArrowLeft, Loader2, Package, Calendar, Building2, FileText, Barcode, Hash, DollarSign, AlertTriangle, Clock, Layers, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Lote, Produto, Fornecedor, Movimentacao, Profile } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR')
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const val = new Date(dateStr)
  val.setHours(0, 0, 0, 0)
  return Math.ceil((val.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getStatusInfo(dateStr: string) {
  const days = daysUntil(dateStr)
  if (days < 0) return { label: 'Vencido', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' }
  if (days <= 30) return { label: `Vence em ${days} dia${days !== 1 ? 's' : ''}`, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30' }
  if (days <= 60) return { label: `Vence em ${days} dias`, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/30' }
  return { label: `Vence em ${days} dias`, color: 'text-muted-foreground bg-muted/30 border-border' }
}

function getTipoBadge(tipo: string) {
  const map: Record<string, { label: string; color: string }> = {
    entrada: { label: 'Entrada', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900/30' },
    saida: { label: 'Saída', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-900/30' },
    ajuste: { label: 'Ajuste', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/30' },
    transferencia: { label: 'Transferência', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/30' },
    perda: { label: 'Perda', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-900/30' },
    descarte: { label: 'Descarte', color: 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-900/30' },
  }
  return map[tipo] || { label: tipo, color: 'bg-muted text-muted-foreground border-border' }
}

export default function LoteDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const { setDynamicLabel } = useBreadcrumbLabel()
  const { profile } = useAuth()
  const [mount, setMount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lote, setLote] = useState<(Lote & { produtos?: Produto; fornecedores?: Fornecedor }) | null>(null)
  const [movimentacoes, setMovimentacoes] = useState<(Movimentacao & { profiles?: Profile })[]>([])

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const [loteRes, movRes] = await Promise.all([
          supabase.from('lotes').select('*, produtos(*), fornecedores(*)').eq('id', params.id).single(),
          supabase.from('movimentacoes').select('*, profiles(*)').eq('lote_id', params.id).order('created_at', { ascending: false }),
        ])
        if (loteRes.data) setLote(loteRes.data)
        if (movRes.data) setMovimentacoes(movRes.data)
      } catch (err) {
        console.error('Erro ao carregar lote:', err)
      } finally {
        setLoading(false)
      }
    }
    if (params.id) load()
  }, [params.id])

  useEffect(() => {
    if (lote?.numero_lote) {
      const label = `Lote ${lote.numero_lote}`
      setDynamicLabel(label)
      document.title = `${label} — ${lote.produtos?.nome || 'Estoque'}`
    }
    return () => setDynamicLabel(null)
  }, [lote, setDynamicLabel])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
    )
  }

  if (!lote) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
        <Package className="h-10 w-10 text-muted-foreground/30" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Lote não encontrado</h3>
        <Button variant="outline" onClick={() => router.back()} className="mt-5 h-9 rounded-xl text-[13px]">
          Voltar
        </Button>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este lote?')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('lotes').delete().eq('id', params.id)
      if (error) {
        if (error.message?.includes('foreign key')) {
          throw new Error('Lote possui movimentações vinculadas. Não é possível excluir.')
        }
        throw error
      }
      toast.success('Lote excluído')
      router.push('/dashboard/estoque/lotes')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Erro ao excluir lote')
    }
  }

  const handleDiscard = async () => {
    if (!confirm(`Descartar ${lote.quantidade_disponivel} unidades restantes? Isso criará uma movimentação de descarte.`)) return
    if (!lote.quantidade_disponivel || lote.quantidade_disponivel <= 0) {
      toast.error('Lote já está com estoque zerado')
      return
    }
    try {
      const supabase = createClient()
      const qtd = lote.quantidade_disponivel
      const { error: movError } = await supabase
        .from('movimentacoes')
        .insert({
          produto_id: lote.produto_id,
          lote_id: lote.id,
          tipo_movimentacao: 'descarte',
          quantidade: qtd,
          usuario_id: profile?.id || null,
          observacao: `Descarte total do lote ${lote.numero_lote}`,
        })
      if (movError) throw movError
      const { error: updError } = await supabase
        .from('lotes')
        .update({ quantidade_disponivel: 0 })
        .eq('id', lote.id)
      if (updError) throw updError
      toast.success(`${qtd} unidades descartadas do lote ${lote.numero_lote}`)
      // Reload page data
      const { data: updated } = await supabase
        .from('lotes').select('*, produtos(*), fornecedores(*)').eq('id', params.id).single()
      if (updated) setLote(updated)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Erro ao descartar lote')
    }
  }

  const statusInfo = getStatusInfo(lote.data_validade)
  const days = daysUntil(lote.data_validade)

  return (
    <div className={`mx-auto max-w-5xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Lote {lote.numero_lote}
            </h1>
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[12px] font-medium ${statusInfo.color}`}>
              {days < 0 && <AlertTriangle className="h-3 w-3" />}
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-0.5 text-[14px] text-muted-foreground">{lote.produtos?.nome || 'Produto não identificado'}</p>
        </div>
        <Button variant="outline" onClick={handleDiscard}
          className="h-10 rounded-xl border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-600 px-3">
          <AlertTriangle className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={handleDelete}
          className="h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive px-3">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
              <Package className="h-4 w-4 text-muted-foreground/50" />
              Produto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[15px] font-medium text-foreground">{lote.produtos?.nome || '—'}</p>
            {lote.produtos?.sku && (
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Barcode className="h-3.5 w-3.5" />
                SKU: {lote.produtos.sku}
              </div>
            )}
            {lote.produtos?.principio_ativo && (
              <p className="text-[13px] text-muted-foreground">{lote.produtos.principio_ativo}</p>
            )}
          </CardContent>
        </Card>

        {/* Validade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground/50" />
              Validade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[15px] font-medium text-foreground">{formatDate(lote.data_validade)}</p>
            {lote.data_fabricacao && (
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Fabricação: {formatDate(lote.data_fabricacao)}
              </div>
            )}
            {lote.registro_anvisa && (
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground pt-1">
                <FileText className="h-3.5 w-3.5" />
                ANVISA: {lote.registro_anvisa}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quantidades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
              <Layers className="h-4 w-4 text-muted-foreground/50" />
              Quantidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Recebida</span>
              <span className="text-[15px] font-medium text-foreground">{lote.quantidade_recebida}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Disponível</span>
              <span className={`text-[15px] font-medium ${lote.quantidade_disponivel === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                {lote.quantidade_disponivel}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Fornecedor */}
        {lote.fornecedores && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground/50" />
                Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[15px] font-medium text-foreground">{lote.fornecedores.nome_fantasia || lote.fornecedores.razao_social}</p>
              {lote.fornecedores.cnpj && (
                <p className="text-[13px] text-muted-foreground">CNPJ: {lote.fornecedores.cnpj}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Nota Fiscal */}
        {lote.nota_fiscal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
                <FileText className="h-4 w-4 text-muted-foreground/50" />
                Nota Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[15px] font-medium text-foreground">{lote.nota_fiscal}</p>
            </CardContent>
          </Card>
        )}

        {/* Lote Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px] font-medium">
              <Hash className="h-4 w-4 text-muted-foreground/50" />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-[15px] font-medium text-foreground">{lote.numero_lote}</div>
            <p className="text-[13px] text-muted-foreground">Criado em {formatDateTime(lote.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Clock className="h-4 w-4 text-muted-foreground/50" />
            Movimentações deste Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="h-8 w-8 text-muted-foreground/20" />
              <p className="mt-3 text-[14px] text-muted-foreground/60">Nenhuma movimentação registrada para este lote</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Data</th>
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Tipo</th>
                    <th className="px-4 py-3 text-right text-[13px] font-medium text-muted-foreground/70">Quantidade</th>
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Usuário</th>
                    <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground/70">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map(m => {
                    const badge = getTipoBadge(m.tipo_movimentacao)
                    return (
                      <tr key={m.id} className="border-b border-border/50 last:border-b-0">
                        <td className="px-4 py-3 text-[14px] text-muted-foreground">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[14px] font-medium text-foreground">{m.quantidade}</td>
                        <td className="px-4 py-3 text-[14px] text-muted-foreground">{m.profiles?.nome || '—'}</td>
                        <td className="px-4 py-3 text-[14px] text-muted-foreground max-w-[200px] truncate">{m.observacao || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}