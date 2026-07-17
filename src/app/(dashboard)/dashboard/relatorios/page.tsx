'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, TrendingUp, TrendingDown, PackageOpen, Users, DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formaPagamentoLabels, tipoDespesaLabels, type Despesa, type Venda, type Paciente } from '@/lib/supabase/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

type Tab = 'fluxo' | 'despesas-cat' | 'vendas-pag' | 'ticket' | 'estoque' | 'pacientes'

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'fluxo', label: 'Fluxo Caixa', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'despesas-cat', label: 'Despesas', icon: <TrendingDown className="h-4 w-4" /> },
  { key: 'vendas-pag', label: 'Vendas (Pagamento)', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'ticket', label: 'Ticket Médio', icon: <DollarSign className="h-4 w-4" /> },
  { key: 'estoque', label: 'Estoque Baixo', icon: <PackageOpen className="h-4 w-4" /> },
  { key: 'pacientes', label: 'Pacientes', icon: <Users className="h-4 w-4" /> },
]

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16', '#64748b']

export default function RelatoriosPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('fluxo')
  const [mount, setMount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Record<string, any>>({})

  useEffect(() => { setMount(true) }, [])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const hoje = new Date()
    const anoPassado = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1).toISOString()

    const [
      { data: vendas },
      { data: despesas },
      { data: pacientes },
      { data: produtos },
    ] = await Promise.all([
      supabase.from('vendas').select('valor_total, forma_pagamento, paciente_id, data_venda').gte('data_venda', anoPassado),
      supabase.from('despesas').select('valor, tipo, data_despesa'),
      supabase.from('pacientes').select('id, nome, created_at'),
      supabase.from('produtos').select('nome, saldo_atual, estoque_minimo, unidade_medida, fabricante').eq('ativo', true).order('saldo_atual', { ascending: true }),
    ])

    setData({ vendas: vendas ?? [], despesas: despesas ?? [], pacientes: pacientes ?? [], produtos: produtos ?? [] })
    setLoading(false)
  }

  function groupByMonth<T>(items: T[], dateField: keyof T, valueField: keyof T): { month: string; value: number }[] {
    const map = new Map<string, number>()
    for (const item of items) {
      const d = new Date(item[dateField] as string)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + Number(item[valueField]))
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }))
  }

  // ── Report 1: Fluxo Caixa ──
  function renderFluxo() {
    const vendas: Venda[] = data.vendas ?? []
    const despesas: Despesa[] = data.despesas ?? []

    const meses = new Set<string>()
    const receitasMap = new Map<string, number>()
    const despesasMap = new Map<string, number>()

    for (const v of vendas) {
      const d = new Date(v.data_venda)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meses.add(key)
      receitasMap.set(key, (receitasMap.get(key) || 0) + Number(v.valor_total))
    }
    for (const d of despesas) {
      const date = new Date(d.data_despesa)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      meses.add(key)
      despesasMap.set(key, (despesasMap.get(key) || 0) + Number(d.valor))
    }

    const chartData = Array.from(meses).sort().map(m => ({
      month: m,
      Receita: receitasMap.get(m) || 0,
      Despesa: despesasMap.get(m) || 0,
      Lucro: (receitasMap.get(m) || 0) - (despesasMap.get(m) || 0),
    }))

    const totalRec = chartData.reduce((s, r) => s + r.Receita, 0)
    const totalDesp = chartData.reduce((s, r) => s + r.Despesa, 0)

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Receita Total" value={`R$ ${totalRec.toFixed(2)}`} color="text-emerald-600 dark:text-emerald-400" />
          <MetricCard label="Despesa Total" value={`R$ ${totalDesp.toFixed(2)}`} color="text-red-600 dark:text-red-400" />
          <MetricCard label="Resultado" value={`R$ ${(totalRec - totalDesp).toFixed(2)}`} color={totalRec >= totalDesp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Report 2: Despesas por Categoria ──
  function renderDespesasCategoria() {
    const despesas: Despesa[] = data.despesas ?? []
    const map = new Map<string, number>()
    for (const d of despesas) {
      const label = tipoDespesaLabels[d.tipo] ?? d.tipo
      map.set(label, (map.get(label) || 0) + Number(d.valor))
    }
    const chartData = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={(p: any) => `${p.name} (${((p.percent ?? 0) * 100).toFixed(0)}%)`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">R$ {item.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Report 3: Vendas por Pagamento ──
  function renderVendasPagamento() {
    const vendas: Venda[] = data.vendas ?? []
    const map = new Map<string, number>()
    for (const v of vendas) {
      const label = formaPagamentoLabels[v.forma_pagamento] ?? v.forma_pagamento
      map.set(label, (map.get(label) || 0) + Number(v.valor_total))
    }
    const chartData = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={(p: any) => `${p.name} (${((p.percent ?? 0) * 100).toFixed(0)}%)`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">R$ {item.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Report 4: Ticket Médio ──
  function renderTicketMedio() {
    const vendas: Venda[] = data.vendas ?? []
    const pacientes: Paciente[] = data.pacientes ?? []

    const pacienteMap = new Map(pacientes.map(p => [p.id, p.nome]))
    const agg = new Map<string, { count: number; total: number }>()

    for (const v of vendas) {
      if (!v.paciente_id) continue
      const cur = agg.get(v.paciente_id) || { count: 0, total: 0 }
      cur.count++
      cur.total += Number(v.valor_total)
      agg.set(v.paciente_id, cur)
    }

    const rows = Array.from(agg.entries())
      .map(([id, { count, total }]) => ({
        nome: pacienteMap.get(id) || 'Desconhecido',
        vendas: count,
        total,
        media: total / count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50)

    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium text-right">Compras</th>
              <th className="px-4 py-3 font-medium text-right">Total Gasto</th>
              <th className="px-4 py-3 font-medium text-right">Ticket Médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-foreground">{r.nome}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{r.vendas}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">R$ {r.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">R$ {r.media.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Report 5: Estoque Baixo ──
  function renderEstoqueBaixo() {
    const produtos = data.produtos ?? []
    const baixo = produtos.filter((p: any) => Number(p.saldo_atual) <= Number(p.estoque_minimo))

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{baixo.length} produto(s) com estoque abaixo do mínimo</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Fabricante</th>
                <th className="px-4 py-3 font-medium text-right">Estoque</th>
                <th className="px-4 py-3 font-medium text-right">Mínimo</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {baixo.map((p: any, i: number) => {
                const ratio = Number(p.saldo_atual) / Math.max(Number(p.estoque_minimo), 1)
                const status = ratio === 0 ? 'Esgotado' : ratio < 0.5 ? 'Crítico' : 'Baixo'
                const statusColor = ratio === 0 ? 'text-red-600 dark:text-red-400' : ratio < 0.5 ? 'text-orange-600 dark:text-orange-400' : 'text-amber-600 dark:text-amber-400'
                return (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{p.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.fabricante || '-'}</td>
                    <td className="px-4 py-3 text-right text-foreground">{p.saldo_atual} {p.unidade_medida}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{p.estoque_minimo}</td>
                    <td className={`px-4 py-3 text-right font-medium ${statusColor}`}>{status}</td>
                  </tr>
                )
              })}
              {baixo.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Todos os produtos com estoque adequado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Report 6: Pacientes por Período ──
  function renderPacientes() {
    const pacientes = data.pacientes ?? []
    const chartData = groupByMonth(pacientes, 'created_at', 'id' as any)
      .map(d => ({ month: d.month, Cadastros: d.value }))

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Total Pacientes" value={String(pacientes.length)} color="text-blue-600 dark:text-blue-400" />
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="Cadastros" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className={cn('mb-8 transition-all duration-500', mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
        <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Relatórios</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Análise de dados da clínica</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all duration-150',
              tab === t.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={cn('transition-all duration-300', mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tab === 'fluxo' ? renderFluxo()
          : tab === 'despesas-cat' ? renderDespesasCategoria()
          : tab === 'vendas-pag' ? renderVendasPagamento()
          : tab === 'ticket' ? renderTicketMedio()
          : tab === 'estoque' ? renderEstoqueBaixo()
          : tab === 'pacientes' ? renderPacientes()
          : null}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}
