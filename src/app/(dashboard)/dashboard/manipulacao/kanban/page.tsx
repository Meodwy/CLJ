'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  STATUS_GROUPS,
  STATUS_COLORS,
  STATUS_LABELS,
  KANBAN_COLUMN_LABELS,
  PRIORITY_LABELS,
  type CompoundingOrder,
  type CompoundingOrderStatus,
  type KanbanColumn,
  type PriorityLevel,
} from '@/lib/compounding/types'
import {
  listOrders,
  checkStock,
  startSeparation,
  markReady,
  completeProduction,
  markDispensed,
  submitReview,
} from '@/lib/compounding/service'

// ─── Flat Status Flow (derived from STATUS_GROUPS) ────────

const COLUMNS = Object.keys(STATUS_GROUPS) as KanbanColumn[]

const FLOW_ORDER: CompoundingOrderStatus[] = COLUMNS.flatMap(
  (col) => STATUS_GROUPS[col],
)

const NEXT_STATUS: Partial<Record<CompoundingOrderStatus, CompoundingOrderStatus>> =
  Object.fromEntries(
    FLOW_ORDER.map((s, i) => [s, FLOW_ORDER[i + 1] ?? null]).filter(
      ([, v]) => v != null,
    ),
  ) as Record<CompoundingOrderStatus, CompoundingOrderStatus>

// ─── Statuses that are terminal (no advance) ──────────────

const TERMINAL_STATUSES: Set<CompoundingOrderStatus> = new Set([
  'CANCELLED',
  'DESTROYED',
  'DISPENSED',
])

// ─── Priority indicator helpers ────────────────────────────

const PRIORITY_BG: Record<PriorityLevel, string> = {
  URGENT: 'bg-destructive/15 text-destructive',
  HIGH: 'bg-orange-500/15 text-orange-500',
  NORMAL: 'bg-blue-500/15 text-blue-500',
  LOW: 'bg-muted-foreground/15 text-muted-foreground',
}

// ─── Status badge background map (mirrors PrescriptionStatusBadge) ──

const COLOR_TO_BG: Record<string, string> = {
  'text-muted-foreground': 'bg-muted-foreground/10',
  'text-amber-500': 'bg-amber-500/10',
  'text-blue-400': 'bg-blue-400/10',
  'text-blue-500': 'bg-blue-500/10',
  'text-blue-600': 'bg-blue-600/10',
  'text-cyan-500': 'bg-cyan-500/10',
  'text-destructive': 'bg-destructive/10',
  'text-destructive/40': 'bg-destructive/10',
  'text-destructive/60': 'bg-destructive/10',
  'text-emerald-400': 'bg-emerald-400/10',
  'text-emerald-500': 'bg-emerald-500/10',
  'text-emerald-600': 'bg-emerald-600/10',
  'text-emerald-700': 'bg-emerald-700/10',
  'text-indigo-500': 'bg-indigo-500/10',
  'text-orange-500': 'bg-orange-500/10',
  'text-orange-600': 'bg-orange-600/10',
  'text-red-600': 'bg-red-600/10',
  'text-violet-500': 'bg-violet-500/10',
  'text-violet-600': 'bg-violet-600/10',
}

function statusBgClass(status: CompoundingOrderStatus): string {
  const color = STATUS_COLORS[status] ?? 'text-muted-foreground'
  return COLOR_TO_BG[color] ?? 'bg-muted-foreground/10'
}

// ─── Days since creation ───────────────────────────────────

function daysSince(dateStr: string): number {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

// ─── Advance RPC routing ───────────────────────────────────

type AdvanceFn = (order: CompoundingOrder) => Promise<unknown>

const ADVANCE_RPC: Partial<Record<CompoundingOrderStatus, AdvanceFn>> = {
  // Within ANALISE — submit review as approved
  DRAFT: (o) =>
    submitReview({ order_id: o.id, checklist_json: { items_ok: true }, approved: true }),
  AWAITING_PHARMACEUTICAL_REVIEW: (o) =>
    submitReview({ order_id: o.id, checklist_json: { items_ok: true }, approved: true }),
  PRESCRIPTION_PENDING: (o) =>
    submitReview({ order_id: o.id, checklist_json: { items_ok: true }, approved: true }),
  PRESCRIPTION_REJECTED: (o) =>
    submitReview({ order_id: o.id, checklist_json: { items_ok: true }, approved: true }),

  // ESTOQUE — check / advance stock
  APPROVED_FOR_PRODUCTION: (o) => checkStock(o.id),
  CHECKING_STOCK: (o) => checkStock(o.id),

  // FILA → SEPARACAO
  QUEUED_FOR_PRODUCTION: (o) => startSeparation(o.id, o.assigned_manipulator_id || ''),

  // CONTROLE — complete production step
  PRODUCTION_COMPLETED: (o) => completeProduction(o.id),

  // LIBERACAO → PRONTA
  RELEASED_BY_PHARMACIST: (o) => markReady(o.id),

  // PRONTA → ENTREGUE
  READY_FOR_PICKUP: (o) => markDispensed(o.id),
}

// ─── Component ─────────────────────────────────────────────

export default function CompoundingKanbanPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<CompoundingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [advancingIds, setAdvancingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listOrders()
      setOrders(data)
    } catch (err) {
      console.error('Failed to load compounding orders:', err)
      setError('Nao foi possivel carregar as ordens de manipulacao.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Group orders by Kanban column
  const grouped = useMemo(() => {
    const map: Record<KanbanColumn, CompoundingOrder[]> = {} as Record<
      KanbanColumn,
      CompoundingOrder[]
    >
    for (const col of COLUMNS) {
      map[col] = []
    }
    for (const order of orders) {
      for (const col of COLUMNS) {
        if ((STATUS_GROUPS[col] as CompoundingOrderStatus[]).includes(order.status)) {
          map[col].push(order)
          break
        }
      }
    }
    return map
  }, [orders])

  // Count totals
  const totalCount = orders.length

  // Advance order to next status
  const handleAdvance = useCallback(
    async (order: CompoundingOrder, e: React.MouseEvent) => {
      e.stopPropagation()

      const nextStatus = NEXT_STATUS[order.status]
      if (!nextStatus) return

      // If already advancing, block double-click
      if (advancingIds.has(order.id)) return

      const rpc = ADVANCE_RPC[order.status]
      if (!rpc) {
        // No simple RPC — navigate to detail page
        router.push(`/dashboard/manipulacao/${order.id}`)
        return
      }

      setAdvancingIds((prev) => {
        const next = new Set(prev)
        next.add(order.id)
        return next
      })

      try {
        await rpc(order)
        // Re-fetch to get updated statuses
        await fetchOrders()
      } catch (err) {
        console.error('Failed to advance order:', err)
        setError('Erro ao avancar ordem. Tente novamente.')
      } finally {
        setAdvancingIds((prev) => {
          const next = new Set(prev)
          next.delete(order.id)
          return next
        })
      }
    },
    [advancingIds, fetchOrders, router],
  )

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Carregando ordens...</p>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="flex h-full flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1"
            onClick={() => router.push('/dashboard/manipulacao')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-xl font-medium text-foreground">
              Kanban &mdash; Manipula&ccedil;&atilde;o
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} ordem{totalCount !== 1 ? 'ns' : ''} no total
            </p>
          </div>
        </div>

        {/* Count badges per column */}
        <div className="hidden gap-1.5 sm:flex">
          {COLUMNS.map((col) => {
            const count = grouped[col].length
            if (count === 0) return null
            return (
              <span
                key={col}
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  col === 'CANCELADO'
                    ? 'bg-destructive/10 text-destructive/70'
                    : col === 'PRONTA'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : col === 'ENTREGUE'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-muted-foreground/10 text-muted-foreground',
                )}
              >
                {KANBAN_COLUMN_LABELS[col]} {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            className="ml-auto text-xs font-medium underline underline-offset-2 hover:no-underline"
            onClick={() => {
              setError(null)
              fetchOrders()
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Kanban board ── */}
      <div className="-mx-6 flex-1 overflow-x-auto px-6 pb-4">
        <div className="flex h-full gap-4" style={{ minWidth: COLUMNS.length * 280 }}>
          {COLUMNS.map((col) => {
            const colOrders = grouped[col]
            const colLabel = KANBAN_COLUMN_LABELS[col]

            return (
              <div
                key={col}
                className="flex w-[260px] shrink-0 flex-col rounded-xl bg-muted/30"
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {colLabel}
                    </h2>
                    <span
                      className={cn(
                        'inline-flex size-5 items-center justify-center rounded-md text-[11px] font-semibold leading-none',
                        colOrders.length > 0
                          ? 'bg-foreground/10 text-foreground'
                          : 'bg-muted-foreground/10 text-muted-foreground/50',
                      )}
                    >
                      {colOrders.length}
                    </span>
                  </div>
                </div>

                {/* Column body */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
                  {colOrders.length === 0 ? (
                    <div className="mt-6 flex flex-col items-center gap-1">
                      <div className="flex h-full min-h-[100px] w-full items-center justify-center rounded-xl border border-dashed border-border/50">
                        <p className="px-3 text-center text-[11px] leading-relaxed text-muted-foreground/40">
                          Nenhuma ordem
                        </p>
                      </div>
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        isAdvancing={advancingIds.has(order.id)}
                        onAdvance={(e) => handleAdvance(order, e)}
                        onCardClick={() =>
                          router.push(`/dashboard/manipulacao/${order.id}`)
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Order Card Sub-component ──────────────────────────────

function OrderCard({
  order,
  isAdvancing,
  onAdvance,
  onCardClick,
}: {
  order: CompoundingOrder
  isAdvancing: boolean
  onAdvance: (e: React.MouseEvent) => void
  onCardClick: () => void
}) {
  const days = daysSince(order.created_at)
  const isTerminal = TERMINAL_STATUSES.has(order.status)
  const hasRpc = ADVANCE_RPC[order.status] != null
  const nextStatus = NEXT_STATUS[order.status]
  const priorityLabel = PRIORITY_LABELS[order.priority] ?? order.priority

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(); } }}
      className={cn(
        'group/card flex w-full flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-3 text-left text-sm shadow-xs transition-all duration-150 ease-[var(--ease-out)]',
        'hover:border-foreground/15 hover:shadow-sm hover:cursor-pointer',
        'active:scale-[0.98]',
        isAdvancing && 'pointer-events-none opacity-60',
      )}
    >
      {/* Row 1: Internal number + Priority */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] font-medium text-foreground">
          {order.internal_number}
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none',
            PRIORITY_BG[order.priority] ?? PRIORITY_BG.NORMAL,
          )}
        >
          {priorityLabel}
        </span>
      </div>

      {/* Row 2: Patient name */}
      <p className="truncate text-sm font-medium text-foreground">
        {order.patient?.nome || `Paciente #${order.patient_id.slice(0, 8)}`}
      </p>

      {/* Row 3: Pharmaceutical form + quantity */}
      <p className="truncate text-xs text-muted-foreground">
        {order.pharmaceutical_form} &mdash; {order.requested_quantity}{' '}
        {order.requested_unit}
      </p>

      {/* Row 4: Status badge */}
      <div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
            STATUS_COLORS[order.status] ?? 'text-muted-foreground',
            statusBgClass(order.status),
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* Row 5: Meta (days + manipulator + advance) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {days === 0 ? 'Hoje' : `${days}d`}
          </span>
          {order.assigned_manipulator_id && (
            <span className="truncate max-w-[100px]">
              Manip. #{order.assigned_manipulator_id.slice(0, 6)}
            </span>
          )}
        </div>

        {/* Advance button */}
        {!isTerminal && hasRpc && nextStatus && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={isAdvancing}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150 ease-[var(--ease-out)]',
              'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
              'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100',
            )}
            title={`Avancar para ${STATUS_LABELS[nextStatus] ?? nextStatus}`}
          >
            {isAdvancing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                Avan&ccedil;ar
                <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        )}

        {/* Fallback: navigate to detail */}
        {!isTerminal && !hasRpc && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCardClick()
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all duration-150 ease-[var(--ease-out)]',
              'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
              'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100',
            )}
            title="Detalhes da ordem"
          >
            Detalhes
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
