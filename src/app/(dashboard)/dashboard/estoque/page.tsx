'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package, AlertTriangle, Clock, Bell, ArrowRight, Loader2,
  PackageOpen, ClipboardCheck, AlertCircle, TrendingDown,
  TrendingUp, ChevronRight, Pill, Syringe, Move,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface DashboardData {
  totalProdutos: number
  abaixoMinimo: number
  lotesVencendo: number
  alertasNaoLidos: number
  produtosEmFalta: number
  lotesVencidos: number
  maisVendidos: number
}

const severityColors = {
  safe: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
  critical: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500', icon: 'text-rose-600 dark:text-rose-400' },
}

function getSeverity(pct: number) {
  if (pct <= 30) return 'critical'
  if (pct <= 60) return 'warning'
  return 'safe'
}

export default function EstoqueDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mount, setMount] = useState(false)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()

        const { count: total } = await supabase
          .from('produtos')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true)

        const { data: produtos, error: prodErr } = await supabase
          .from('produtos')
          .select('id, saldo_atual, estoque_minimo')
          .eq('ativo', true)

        const abaixo = produtos?.filter(p => p.estoque_minimo > 0 && p.saldo_atual <= p.estoque_minimo).length ?? 0

        const trintaDias = new Date()
        trintaDias.setDate(trintaDias.getDate() + 30)

        const { count: vencendo } = await supabase
          .from('lotes')
          .select('*', { count: 'exact', head: true })
          .gte('data_validade', new Date().toISOString().split('T')[0])
          .lte('data_validade', trintaDias.toISOString().split('T')[0])
          .gt('quantidade_disponivel', 0)

        const { count: alertas } = await supabase
          .from('alertas')
          .select('*', { count: 'exact', head: true })
          .eq('lido', false)

        // ── Resumo Rapido queries ──

        // Produtos em falta (saldo_atual <= estoque_minimo)
        // Column-to-column comparison not supported via REST API, fetch + filter client-side
        const { data: todosProdutos } = await supabase
          .from('produtos')
          .select('saldo_atual, estoque_minimo')
          .eq('ativo', true)
          .gt('estoque_minimo', 0)
        const produtosEmFalta = todosProdutos?.filter(p => p.saldo_atual <= p.estoque_minimo).length ?? 0

        // Lotes vencidos
        const { count: vencidos } = await supabase
          .from('lotes')
          .select('*', { count: 'exact', head: true })
          .lt('data_validade', new Date().toISOString().split('T')[0])
          .gt('quantidade_disponivel', 0)

        // Mais vendidos (produtos com saida em movimentacoes)
        let maisVendidos = 0
        try {
          const { count: mv } = await supabase
            .from('movimentacoes')
            .select('produto_id', { count: 'exact', head: true })
            .eq('tipo_movimentacao', 'saida')
          maisVendidos = mv ?? 0
        } catch {
          maisVendidos = 0
        }

        setData({
          totalProdutos: total ?? 0,
          abaixoMinimo: abaixo,
          lotesVencendo: vencendo ?? 0,
          alertasNaoLidos: alertas ?? 0,
          produtosEmFalta: produtosEmFalta,
          lotesVencidos: vencidos ?? 0,
          maisVendidos: maisVendidos,
        })
      } catch (err) {
        console.error(err)
        setData({ totalProdutos: 0, abaixoMinimo: 0, lotesVencendo: 0, alertasNaoLidos: 0, produtosEmFalta: 0, lotesVencidos: 0, maisVendidos: 0 })
      }
      setLoading(false)
    }
    load()
  }, [])

  const summaryCards = [
    {
      label: 'Produtos Ativos', value: data?.totalProdutos ?? 0, icon: Package,
      desc: 'Total no inventario', pct: 85, trend: 'up' as const,
      action: { label: 'Ver catalogo', href: '/dashboard/estoque/produtos' },
    },
    {
      label: 'Abaixo do Minimo', value: data?.abaixoMinimo ?? 0, icon: AlertTriangle,
      desc: 'Produtos criticos', pct: data?.totalProdutos ? Math.round(((data?.abaixoMinimo ?? 0) / data.totalProdutos) * 100) : 0, trend: 'down' as const,
      action: { label: 'Inventário', href: '/dashboard/estoque/inventario' },
    },
    {
      label: 'Lotes Vencendo (30d)', value: data?.lotesVencendo ?? 0, icon: Clock,
      desc: 'Atencao as validades', pct: data?.totalProdutos ? Math.round(((data?.lotesVencendo ?? 0) / data.totalProdutos) * 100) : 0, trend: 'down' as const,
      action: { label: 'Ver lotes', href: '/dashboard/estoque/lotes' },
    },
    {
      label: 'Alertas Nao Lidos', value: data?.alertasNaoLidos ?? 0, icon: Bell,
      desc: 'Notificacoes pendentes', pct: 0, trend: 'neutral' as const,
      action: { label: 'Ver alertas', href: '/dashboard/estoque/alertas' },
    },
  ]

  const navLinks = [
    { label: 'Produtos', href: '/dashboard/estoque/produtos', icon: PackageOpen, desc: 'Gerenciar catalogo' },
    { label: 'Inventário', href: '/dashboard/estoque/inventario', icon: ClipboardCheck, desc: 'Contagem e ajustes' },
    { label: 'Movimentações', href: '/dashboard/estoque/movimentacoes', icon: Move, desc: 'Entradas e saídas' },
    { label: 'Lotes', href: '/dashboard/estoque/lotes', icon: Clock, desc: 'Controle de validades' },
    { label: 'Alertas', href: '/dashboard/estoque/alertas', icon: AlertCircle, desc: 'Notificacoes' },
    { label: 'Fornecedores', href: '/dashboard/estoque/fornecedores', icon: PackageOpen, desc: 'Cadastro' },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div
        className={`mb-8 transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Estoque</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {loading ? 'Carregando...' : 'Visao geral do inventario'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/dashboard/estoque/produtos')}
              variant="outline"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
            >
              <PackageOpen className="mr-1.5 h-4 w-4" />Gerenciar
            </Button>
            <Button
              onClick={() => router.push('/dashboard/estoque/inventario')}
              className="h-10 rounded-xl bg-primary px-4 text-[13px] font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ transitionTimingFunction: 'var(--ease-out)' }}
            >
              <ClipboardCheck className="mr-1.5 h-4 w-4" />Inventário
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      ) : (
        <>
          {/* ─── Summary Cards with Progress Bars ─── */}
          <div
            className={`mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-500 delay-75 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {summaryCards.map((card, i) => {
              const Icon = card.icon
              const severity = getSeverity(card.pct)
              const colors = severityColors[severity]
              return (
                <div
                  key={card.label}
                  className="card-accent relative rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ transitionTimingFunction: 'var(--ease-out)' }}
                >
                  <div className="p-5">
                    {/* Icon + Value row */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}>
                        <Icon className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <span className="font-heading text-[30px] font-bold tracking-tight text-foreground">
                        {card.value}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground/60">{card.desc}</p>

                    {/* Progress bar for applicable cards */}
                    {card.trend !== 'neutral' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`flex items-center gap-1 text-[11px] font-medium ${
                            card.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {card.trend === 'up'
                              ? <><TrendingUp className="h-3 w-3" /> Estavel</>
                              : <><TrendingDown className="h-3 w-3" /> Atencao</>
                            }
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground/50">
                            {card.pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                            style={{ width: `${Math.min(card.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Quick action link */}
                    <button
                      onClick={() => router.push(card.action.href)}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border/60 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-all duration-200 hover:bg-muted hover:text-foreground"
                      style={{ transitionTimingFunction: 'var(--ease-out)' }}
                    >
                      {card.action.label} <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ─── Bottom Sections ─── */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Quick Stats Section */}
            <div
              className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[150ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              style={{ transitionTimingFunction: 'var(--ease-out)' }}
            >
              <h2 className="mb-4 font-heading text-[15px] font-semibold text-foreground">Resumo Rapido</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Produtos em falta', value: data?.produtosEmFalta ?? 0, icon: Pill, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20' },
                  { label: 'Lotes vencidos', value: data?.lotesVencidos ?? 0, icon: Clock, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
                  { label: 'Mov. saida (30d)', value: data?.maisVendidos ?? 0, icon: Syringe, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-lg bg-muted/40 p-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-[18px] font-bold text-foreground">{item.value}</p>
                      <p className="text-[11px] text-muted-foreground/60">{item.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modules */}
            <div
              className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[200ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              style={{ transitionTimingFunction: 'var(--ease-out)' }}
            >
              <h2 className="mb-4 font-heading text-[15px] font-semibold text-foreground">Modulos de Estoque</h2>
              <div className="grid grid-cols-2 gap-3">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <button
                      key={link.label}
                      onClick={() => router.push(link.href)}
                      className="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-sm active:scale-[0.98]"
                      style={{ transitionTimingFunction: 'var(--ease-out)' }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground">{link.label}</p>
                        <p className="text-[11px] text-muted-foreground/60">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 transition-colors group-hover:text-primary/60" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}