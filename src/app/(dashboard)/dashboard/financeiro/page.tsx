'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import {
  DollarSign, TrendingUp, TrendingDown, PiggyBank, Plus,
  ArrowUpRight, ArrowDownRight, Loader2, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formaPagamentoLabels, type Venda, type Despesa } from '@/lib/supabase/types'

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano'

const severityColors = {
  positive: { icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  negative: { icon: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  neutral:  { icon: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  accent:   { icon: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
}

export default function FinanceiroPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [mount, setMount] = useState(false)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [vendas, setVendas] = useState<Venda[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [comprasTotal, setComprasTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => { loadData() }, [periodo])

  function getDateFilter() {
    const now = new Date()
    let start: Date
    switch (periodo) {
      case 'hoje':    start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
      case 'semana':  start = new Date(now.getTime() - 7 * 86400000); break
      case 'mes':     start = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'ano':     start = new Date(now.getFullYear(), 0, 1); break
    }
    return start.toISOString()
  }

  async function loadData() {
    setLoading(true)

    // Role check: only administrador, farmaceutico, and financeiro can access financial data
    if (profile && (profile.role === 'atendente' || profile.role === 'manipulador' || profile.role === 'estoquista')) {
      setVendas([])
      setDespesas([])
      setComprasTotal(0)
      setLoading(false)
      return
    }

    const dateFilter = getDateFilter()

    const [vendasRes, despesasRes, comprasRes] = await Promise.all([
      supabase.from('vendas').select('*').gte('data_venda', dateFilter).order('created_at', { ascending: false }),
      supabase.from('despesas').select('*').gte('data_despesa', dateFilter).order('created_at', { ascending: false }),
      supabase.from('compras').select('valor_total').gte('data_compra', dateFilter),
    ])

    if (vendasRes.data) setVendas(vendasRes.data)
    if (despesasRes.data) setDespesas(despesasRes.data)
    if (comprasRes.data) {
      setComprasTotal(comprasRes.data.reduce((acc, c) => acc + (c.valor_total ?? 0), 0))
    }
    setLoading(false)
  }

  const receitaTotal   = vendas.reduce((acc, v) => acc + Number(v.valor_total), 0)
  const despesaTotal   = despesas.reduce((acc, d) => acc + Number(d.valor), 0) + comprasTotal
  const lucro          = receitaTotal - despesaTotal
  const margem         = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0

  const periodos: { value: Periodo; label: string }[] = [
    { value: 'hoje', label: 'Hoje' },
    { value: 'semana', label: '7 Dias' },
    { value: 'mes', label: 'Mês' },
    { value: 'ano', label: 'Ano' },
  ]

  const recentTransactions = [
    ...vendas.slice(0, 5).map(v => ({
      id: v.id, type: 'venda' as const,
      descricao: `Venda — ${formaPagamentoLabels[v.forma_pagamento]}`,
      valor: Number(v.valor_total),
      data: v.data_venda,
    })),
    ...despesas.slice(0, 5).map(d => ({
      id: d.id, type: 'despesa' as const,
      descricao: d.descricao,
      valor: Number(d.valor),
      data: d.data_despesa,
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 10)

  if (!profile || profile.role === 'atendente' || profile.role === 'manipulador' || profile.role === 'estoquista') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">Sem acesso ao módulo financeiro.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Header ── */}
      <div
        className={`mb-8 transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">
              Financeiro
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {loading ? 'Carregando...' : `Resumo do período — ${periodos.find(p => p.value === periodo)?.label}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/dashboard/financeiro/vendas/nova')}
              variant="outline"
              className="h-10 rounded-xl px-4 text-[13px] font-medium"
            >
              <Plus className="mr-1.5 h-4 w-4" />Nova Venda
            </Button>
            <Button
              onClick={() => router.push('/dashboard/financeiro/despesas/nova')}
              className="h-10 rounded-xl bg-primary px-4 text-[13px] font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ transitionTimingFunction: 'var(--ease-out)' }}
            >
              <ArrowDownRight className="mr-1.5 h-4 w-4" />Nova Despesa
            </Button>
          </div>
        </div>

        {/* Period filter */}
        <div className="mt-4 flex gap-1 rounded-lg border p-0.5 bg-card w-fit">
          {periodos.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                periodo === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      ) : (
        <>
          <div
            className={`mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-500 delay-75 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {/* Receita */}
            <KPICard
              label="Receita"
              value={`R$ ${receitaTotal.toFixed(2)}`}
              desc={`${vendas.length} venda(s) no período`}
              icon={TrendingUp}
              colors={severityColors.positive}
            />
            {/* Despesas */}
            <KPICard
              label="Despesas"
              value={`R$ ${despesaTotal.toFixed(2)}`}
              desc={`${despesas.length} despesa(s) registrada(s)`}
              icon={TrendingDown}
              colors={severityColors.negative}
            />
            {/* Lucro */}
            <KPICard
              label="Lucro"
              value={`${lucro >= 0 ? '' : '-'}R$ ${Math.abs(lucro).toFixed(2)}`}
              desc={lucro >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
              icon={PiggyBank}
              colors={lucro >= 0 ? severityColors.neutral : severityColors.negative}
            />
            {/* Margem */}
            <KPICard
              label="Margem"
              value={`${margem.toFixed(1)}%`}
              desc="Margem sobre receita"
              icon={DollarSign}
              colors={severityColors.accent}
            />
          </div>

          {/* ── Recent Transactions ── */}
          <div
            className={`rounded-xl border border-border bg-card shadow-sm transition-all duration-500 delay-[150ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
              <h2 className="font-heading text-[15px] font-semibold text-foreground">Movimentações Recentes</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => router.push('/dashboard/financeiro/vendas')}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  Vendas
                </button>
                <button
                  onClick={() => router.push('/dashboard/financeiro/despesas')}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  Despesas
                </button>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {recentTransactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação no período
                </div>
              ) : (
                recentTransactions.map(tx => (
                  <div
                    key={tx.id + tx.type}
                    className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        tx.type === 'venda' ? severityColors.positive.bg : severityColors.negative.bg
                      )}>
                        {tx.type === 'venda'
                          ? <ArrowUpRight className={cn('h-4 w-4', severityColors.positive.icon)} />
                          : <ArrowDownRight className={cn('h-4 w-4', severityColors.negative.icon)} />
                        }
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{tx.descricao}</p>
                        <p className="text-[12px] text-muted-foreground/60">
                          {new Date(tx.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-[14px] font-semibold',
                      tx.type === 'venda' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {tx.type === 'venda' ? '+' : '-'}R$ {tx.valor.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── KPI Card Sub-component ──
function KPICard({
  label, value, desc, icon: Icon, colors,
}: {
  label: string; value: string; desc: string; icon: React.ElementType; colors: typeof severityColors.positive
}) {
  return (
    <div
      className="card-accent relative rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
        </div>
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="font-heading text-[24px] font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground/60">{desc}</p>
      </div>
    </div>
  )
}
