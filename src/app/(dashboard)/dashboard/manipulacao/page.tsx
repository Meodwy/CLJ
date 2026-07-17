'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FlaskConical,
  Plus,
  Columns3,
  ClipboardList,
  Beaker,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface SummaryCard {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}

interface RecentOrder {
  id: string
  internal_number: string
  status: string
  patient_name: string | null
  created_at: string
}

export default function ManipulacaoPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryCard[]>([
    { label: 'Aguardando Analise', value: 0, icon: <ClipboardList className="h-5 w-5" />, color: 'text-amber-500' },
    { label: 'Em Producao', value: 0, icon: <Beaker className="h-5 w-5" />, color: 'text-indigo-500' },
    { label: 'Aguardando Liberacao', value: 0, icon: <Clock className="h-5 w-5" />, color: 'text-orange-500' },
    { label: 'Prontas para Retirada', value: 0, icon: <PackageCheck className="h-5 w-5" />, color: 'text-emerald-500' },
  ])
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [{ getSummary }, { createClient }] = await Promise.all([
          import('@/lib/compounding/service'),
          import('@/lib/supabase/client'),
        ])
        const [summaryData, ordersRes] = await Promise.all([
          getSummary(),
          createClient()
            .from('compounding_orders')
            .select('id, internal_number, status, patient_id, created_at')
            .order('created_at', { ascending: false })
            .limit(10),
        ])
        setSummary([
          { label: 'Aguardando Analise', value: summaryData.awaiting_analysis, icon: <ClipboardList className="h-5 w-5" />, color: 'text-amber-500' },
          { label: 'Em Producao', value: summaryData.in_production, icon: <Beaker className="h-5 w-5" />, color: 'text-indigo-500' },
          { label: 'Aguardando Liberacao', value: summaryData.awaiting_release, icon: <Clock className="h-5 w-5" />, color: 'text-orange-500' },
          { label: 'Prontas para Retirada', value: summaryData.ready_for_pickup, icon: <PackageCheck className="h-5 w-5" />, color: 'text-emerald-500' },
        ])
        if (!ordersRes.error && ordersRes.data) {
          const orders = ordersRes.data as any[]
          const patientIds = [...new Set(orders.map(o => o.patient_id).filter(Boolean))]
          const patientMap: Record<string, string> = {}
          if (patientIds.length > 0) {
            const { data: patients } = await createClient()
              .from('pacientes')
              .select('id, nome')
              .in('id', patientIds)
            if (patients) {
              for (const p of patients) patientMap[p.id] = p.nome
            }
          }
          setRecentOrders(orders.map(o => ({
            id: o.id,
            internal_number: o.internal_number,
            status: o.status,
            patient_name: patientMap[o.patient_id] ?? 'Paciente',
            created_at: o.created_at,
          })))
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [])

  const canManipulate = profile?.role === 'administrador' || profile?.role === 'manipulador' || profile?.role === 'farmaceutico'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/10">
              <FlaskConical className="h-[18px] w-[18px] text-indigo-500" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-medium text-foreground">
                Manipulacao
              </h1>
              <p className="text-sm text-muted-foreground">
                {canManipulate
                  ? 'Gerencie ordens de manipulacao, separacao, pesagem e liberacao'
                  : 'Acompanhe o status das ordens de manipulacao'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => router.push('/dashboard/manipulacao/nova')}
          >
            <Plus className="h-4 w-4" />
            Nova Ordem
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/manipulacao/kanban')}
          >
            <Columns3 className="h-4 w-4" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} size="sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </CardTitle>
                <span className={item.color}>{item.icon}</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
              ) : (
                <p className="font-heading text-2xl font-semibold text-foreground">
                  {item.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => router.push('/dashboard/manipulacao?tab=analise')}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-amber-500/30 hover:bg-amber-500/[0.03]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 transition-all duration-200 group-hover:bg-amber-500/15">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Em Analise</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Revisao farmaceutica</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-amber-500 group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={() => router.push('/dashboard/manipulacao?tab=producao')}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-indigo-500/30 hover:bg-indigo-500/[0.03]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 transition-all duration-200 group-hover:bg-indigo-500/15">
            <Beaker className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Em Producao</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Separacao, pesagem, manipulacao</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-indigo-500 group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={() => router.push('/dashboard/manipulacao?tab=liberacao')}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 transition-all duration-200 group-hover:bg-emerald-500/15">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Liberacao</p>
            <p className="mt-0.5 text-xs text-muted-foreground">CQ final e liberacao farmaceutica</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-emerald-500 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Ordens Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" /></div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <FlaskConical className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhuma ordem de manipulacao encontrada</p>
              <p className="mt-1 text-xs text-muted-foreground">
                As ordens aparecerao aqui assim que forem criadas a partir de receitas aprovadas.
              </p>
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>O modulo Kanban esta disponivel para visualizacao em colunas</span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => router.push(`/dashboard/manipulacao/${order.id}`)}
                  className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-muted/30 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{order.internal_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{order.patient_name || 'Sem paciente'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{order.status.replace(/_/g, ' ')}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
