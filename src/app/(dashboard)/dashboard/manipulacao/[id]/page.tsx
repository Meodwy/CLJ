'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBreadcrumbLabel } from '@/contexts/breadcrumb-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Clock, Calendar,
  User, FlaskConical, Package, CheckCircle2, XCircle, FileText,
  Layers, Scale, AlertTriangle, Send,
} from 'lucide-react'
import { getOrder, checkStock, reserveStock, startSeparation, registerWeighing, completeWeighing, completeProduction, signRelease, markReady, markDispensed } from '@/lib/compounding/service'
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  KANBAN_COLUMN_LABELS, STATUS_GROUPS, ITEM_TYPE_LABELS,
  type CompoundingOrderWithRelations, type CompoundingOrderStatus, type KanbanColumn, type CompoundingOrderItem,
} from '@/lib/compounding/types'
import { cn } from '@/lib/utils'

function statusColor(status: CompoundingOrderStatus) {
  return STATUS_COLORS[status] ?? 'text-muted-foreground'
}

function statusLabel(status: CompoundingOrderStatus) {
  return STATUS_LABELS[status] ?? status
}

function findKanbanColumn(status: CompoundingOrderStatus): KanbanColumn | null {
  for (const [col, statuses] of Object.entries(STATUS_GROUPS)) {
    if ((statuses as CompoundingOrderStatus[]).includes(status)) return col as KanbanColumn
  }
  return null
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR')
}

export default function OrdemDetalhesPage() {
  const params = useParams()
  const router = useRouter()
  const { setDynamicLabel } = useBreadcrumbLabel()
  const [order, setOrder] = useState<CompoundingOrderWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [userProfile, setUserProfile] = useState<{ nome: string; role: string } | null>(null)
  const [weighingQty, setWeighingQty] = useState<Record<string, string>>({})
  const [weighingLoad, setWeighingLoad] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return
    let cancelled = false
    const load = async () => {
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('nome, role').eq('id', user.id).single()
          setUserProfile(profile)
        }
        const data = await getOrder(params.id as string)
        if (cancelled) return
        setOrder(data)
        setDynamicLabel(`Ordem ${data.internal_number}`)
      } catch (err) {
        console.error('Erro ao carregar ordem:', err)
        setError('Nao foi possivel carregar a ordem.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true; setDynamicLabel(null) }
  }, [params.id, setDynamicLabel])

  const handleAdvance = async () => {
    if (!order || advancing) return
    setAdvancing(true)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nao autenticado')
      const userId = user.id

      switch (order.status) {
        case 'APPROVED_FOR_PRODUCTION':
          // Avanca status antes de verificar estoque
          const { error: updateErr } = await supabase
            .from('compounding_orders')
            .update({ status: 'CHECKING_STOCK' })
            .eq('id', order.id)
          if (updateErr) throw updateErr
          await checkStock(order.id); break
        case 'CHECKING_STOCK': {
          const stockResult = await checkStock(order.id)
          // Se todos disponiveis, ja reserva estoque automaticamente
          if (stockResult.all_available) {
            await reserveStock(order.id)
          }
          break
        }
        case 'MISSING_STOCK':
        case 'AWAITING_PURCHASE':
          await reserveStock(order.id); break
        case 'STOCK_RESERVED':
          await startSeparation(order.id, userId); break
        case 'QUEUED_FOR_PRODUCTION':
          await startSeparation(order.id, userId); break
        case 'IN_SEPARATION': {
          const { error: weighErr } = await supabase
            .from('compounding_orders')
            .update({ status: 'AWAITING_WEIGHING' })
            .eq('id', order.id)
          if (weighErr) throw weighErr
          break
        }
        case 'AWAITING_WEIGHING':
        case 'IN_WEIGHING':
          await completeWeighing(order.id)
          // Marca inicio da producao — via RPC ja seta production_started_at, mas garante via client tb
          const { error: startErr } = await supabase
            .from('compounding_orders')
            .update({ production_started_at: new Date().toISOString() })
            .eq('id', order.id)
          if (startErr) throw startErr
          break
        case 'IN_COMPOUNDING':
        case 'IN_PROCESS_CONTROL':
        case 'AWAITING_PACKAGING':
        case 'IN_PACKAGING':
        case 'AWAITING_LABELING':
        case 'IN_LABELING': {
          // Auto-cria etapa de manipulacao se nao existir
          const { data: existingSteps } = await supabase
            .from('compounding_steps')
            .select('id')
            .eq('order_id', order.id)
            .limit(1)
          if (!existingSteps || existingSteps.length === 0) {
            const { error: stepErr } = await supabase.from('compounding_steps').insert({
              order_id: order.id,
              sequence: 1,
              step_type: 'MIXING',
              instruction_version: '1',
              approved_instruction: 'Instrucao padrao automatica',
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              notes: 'Etapa automatica',
            })
            if (stepErr) throw stepErr
          } else {
            // Marca etapas pendentes como concluidas
            await supabase
              .from('compounding_steps')
              .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
              .eq('order_id', order.id)
              .in('status', ['PENDING', 'IN_PROGRESS'])
          }
          await completeProduction(order.id)
          break
        }
        case 'PRODUCTION_COMPLETED': {
          // Avanca para aguardando liberacao farmaceutica
          const { error: releaseErr } = await supabase
            .from('compounding_orders')
            .update({ status: 'AWAITING_PHARMACIST_RELEASE' })
            .eq('id', order.id)
          if (releaseErr) throw releaseErr
          break
        }
        case 'AWAITING_PHARMACIST_RELEASE':
          await signRelease({ order_id: order.id, pharmacist_name: userProfile?.nome || 'Farmaceutico', crf_number: '000000', crf_state: 'SP', decision: 'APPROVED', notes: 'Liberado' }); break
        case 'RELEASED_BY_PHARMACIST':
          await markReady(order.id); break
        case 'READY_FOR_PICKUP':
          await markDispensed(order.id); break
        default:
          throw new Error(`Status "${statusLabel(order.status)}" nao possui acao automatica`)
      }
      const updated = await getOrder(order.id)
      setOrder(updated)
      setDynamicLabel(`Ordem ${updated.internal_number}`)
    } catch (err) {
      console.error('Erro ao avancar:', err)
      console.error('Detalhes:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
      alert(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setAdvancing(false)
    }
  }

  const canAdvance = order && !['DRAFT', 'DISPENSED', 'CANCELLED', 'DESTROYED', 'PRESCRIPTION_PENDING', 'PRESCRIPTION_REJECTED', 'RELEASE_REJECTED', 'REWORK_REQUIRED', 'AWAITING_FINAL_QUALITY_CONTROL', 'OUT_FOR_DELIVERY'].includes(order.status)

  const isWeighingPhase = order?.status === 'AWAITING_WEIGHING' || order?.status === 'IN_WEIGHING'

  const handleRegisterWeighing = async (item: CompoundingOrderItem) => {
    const qty = parseFloat(weighingQty[item.id])
    if (isNaN(qty) || qty <= 0) { alert('Informe a quantidade pesada'); return }
    const reservation = order?.reservations?.find(r => r.order_item_id === item.id)
    if (!reservation) { alert('Nenhuma reserva encontrada para este item'); return }
    setWeighingLoad(item.id)
    try {
      await registerWeighing({
        order_item_id: item.id,
        reservation_id: reservation.id,
        sequence: item.sequence,
        theoretical_qty: item.theoretical_quantity,
        actual_qty: qty,
        unit: item.unit,
      })
      const updated = await getOrder(order!.id)
      setOrder(updated)
      setWeighingQty(prev => ({ ...prev, [item.id]: '' }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao registrar pesagem')
    } finally {
      setWeighingLoad(null)
    }
  }

  const weighedItems = new Set(
    (order?.weighings ?? [])
      .filter(w => w.status === 'RECORDED')
      .map(w => w.order_item_id)
  )

  const rejectedWeighItems = new Set(
    (order?.weighings ?? [])
      .filter(w => w.status === 'REJECTED')
      .map(w => w.order_item_id)
  )

  const allItemsWeighed = order?.items?.every(item => weighedItems.has(item.id)) ?? false

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
        <h3 className="mt-4 text-base font-semibold text-foreground">
          {error || 'Ordem nao encontrada'}
        </h3>
        <Button variant="outline" onClick={() => router.back()} className="mt-5">
          Voltar
        </Button>
      </div>
    )
  }

  const col = findKanbanColumn(order.status)
  const colLabel = col ? KANBAN_COLUMN_LABELS[col] : null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
              Ordem {order.internal_number}
            </h1>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium', statusColor(order.status), 'bg-current/10')}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel(order.status)}
            </span>
            {colLabel && (
              <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {colLabel}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Prioridade {PRIORITY_LABELS[order.priority]} &middot; Criado em {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* ── Patient Info ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4 text-muted-foreground/50" />
            Paciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium text-foreground">{order.patient?.nome ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="text-sm font-medium text-foreground">{order.patient?.cpf ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium text-foreground">{order.patient?.telefone ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Order Details ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground/50" />
            Detalhes da Ordem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Forma Farmaceutica</p>
              <p className="text-sm font-medium text-foreground">{order.pharmaceutical_form}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantidade</p>
              <p className="text-sm font-medium text-foreground">{order.requested_quantity} {order.requested_unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lote Final</p>
              <p className="text-sm font-medium text-foreground">{order.final_batch_number ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Farmaceutico Responsavel</p>
              <p className="text-sm font-medium text-foreground">{order.pharmacist?.nome ?? 'Nao atribuido'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Manipulador</p>
              <p className="text-sm font-medium text-foreground">{order.assigned_manipulator?.nome ?? 'Nao atribuido'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prioridade</p>
              <p className={cn('text-sm font-medium', PRIORITY_COLORS[order.priority])}>{PRIORITY_LABELS[order.priority]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data Prevista</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.due_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inicio Producao</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.production_started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conclusao</p>
              <p className="text-sm font-medium text-foreground">{formatDate(order.production_completed_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Items ── */}
      {(order.items ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-muted-foreground/50" />
              Itens ({order.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 gap-2 pb-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Item</span>
                <span className="col-span-2">Tipo</span>
                <span className="col-span-2 text-right">Qtd Teorica</span>
                <span className="col-span-2 text-right">Qtd Consumida</span>
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 py-2.5 text-sm">
                  <span className="col-span-1 text-xs text-muted-foreground">{item.sequence}</span>
                  <span className="col-span-4 font-medium text-foreground truncate">{item.inventory_item_name ?? item.inventory_item_id.slice(0, 16) + '...' + item.inventory_item_id.slice(-4)}</span>
                  <span className="col-span-2 text-xs text-muted-foreground">{ITEM_TYPE_LABELS[item.item_type] || item.item_type}</span>
                  <span className="col-span-2 text-right text-foreground">{item.theoretical_quantity} {item.unit}</span>
                  <span className="col-span-2 text-right text-foreground">{item.actual_consumed_quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Weighing UI ── */}
      {isWeighingPhase && order.items && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-muted-foreground/50" />
              Pesagem dos Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => {
                const isWeighted = weighedItems.has(item.id)
                const isRejected = rejectedWeighItems.has(item.id)
                const reservation = order.reservations?.find(r => r.order_item_id === item.id)
                return (
                  <div key={item.id} className="flex items-end gap-3 rounded-lg border p-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">{item.inventory_item_name ?? item.inventory_item_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Qtd teorica: {item.theoretical_quantity} {item.unit}
                        {reservation && ` | Reservado: ${reservation.reserved_quantity} ${reservation.unit}`}
                      </p>
                      {isWeighted && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pesado
                        </p>
                      )}
                      {isRejected && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Rejeitado
                        </p>
                      )}
                    </div>
                    {!isWeighted && (
                      <div className="flex items-end gap-2">
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">Qtd real</Label>
                          <Input
                            className="h-9 w-24"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={String(item.theoretical_quantity)}
                            value={weighingQty[item.id] ?? ''}
                            onChange={(e) => setWeighingQty(prev => ({ ...prev, [item.id]: e.target.value }))}
                            disabled={weighingLoad === item.id}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={weighingLoad === item.id}
                          onClick={() => handleRegisterWeighing(item)}
                        >
                          {weighingLoad === item.id ? 'Pesando...' : 'Pesar'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="default"
                  disabled={!allItemsWeighed || advancing}
                  onClick={handleAdvance}
                >
                  {advancing ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  )}
                  Finalizar Pesagem
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Steps / Timeline ── */}
      {(order.steps ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-muted-foreground/50" />
              Etapas ({order.steps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.steps
                .sort((a, b) => a.sequence - b.sequence)
                .map((step) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        step.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                        step.status === 'IN_PROGRESS' ? 'bg-indigo-500/10 text-indigo-500' :
                        step.status === 'DEVIATED' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground/50',
                      )}>
                        {step.status === 'COMPLETED' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                         step.status === 'DEVIATED' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                         step.sequence}
                      </div>
                      {step.sequence < order.steps.length && (
                        <div className="h-full w-px bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-foreground">{step.step_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.started_at ? `Iniciado ${formatDate(step.started_at)}` : 'Pendente'}
                        {step.completed_at ? ` — Concluido ${formatDate(step.completed_at)}` : ''}
                      </p>
                      {step.notes && (
                        <p className="mt-1 text-xs text-muted-foreground/70 italic">{step.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Status History ── */}
      {(order.status_history ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground/50" />
              Historico de Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.status_history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{h.previous_status ? statusLabel(h.previous_status as CompoundingOrderStatus) : '—'}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                    <span className={cn('text-xs font-medium', statusColor(h.new_status as CompoundingOrderStatus))}>
                      {statusLabel(h.new_status as CompoundingOrderStatus)}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50">{formatDate(h.changed_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Avancar Etapa ── */}
      {canAdvance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Send className="h-4 w-4 text-muted-foreground/50" />
              Avancar Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">
                  Status atual: <span className="font-medium">{statusLabel(order!.status)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Clique no botao para avancar para a proxima etapa do fluxo de manipulacao.
                </p>
              </div>
              <Button onClick={handleAdvance} disabled={advancing}>
                {advancing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1.5 h-4 w-4" />}
                {advancing ? 'Avancando...' : 'Avancar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pb-8">
        <Button variant="outline" onClick={() => router.push('/dashboard/manipulacao/kanban')}>
          <FlaskConical className="h-4 w-4" />
          Kanban
        </Button>
        <Button variant="outline" onClick={() => router.push('/dashboard/manipulacao')}>
          Voltar ao Painel
        </Button>
      </div>
    </div>
  )
}
