'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import {
  Users, Calendar, FileText, Package, FlaskConical, DollarSign,
  BarChart3, TrendingUp, ArrowRight, Clock, AlertTriangle,
  ChevronRight, Activity, Pill, Syringe, type LucideIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Role = 'administrador' | 'farmaceutico' | 'atendente' | 'manipulador' | 'estoquista' | 'financeiro'
const roleLabels: Record<Role, string> = {
  administrador: 'Administrador', farmaceutico: 'Farmacêutico', atendente: 'Atendente',
  manipulador: 'Manipulador', estoquista: 'Estoquista', financeiro: 'Financeiro',
}

interface ModuleCard {
  title: string; description: string; icon: LucideIcon; href: string; roles: Role[]; accent: string
}
const modules: ModuleCard[] = [
  { title: 'Pacientes', description: 'Cadastro e gestao', icon: Users, href: '/dashboard/pacientes', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'], accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
  { title: 'Agendamentos', description: 'Agenda de horarios', icon: Calendar, href: '/dashboard/agendamentos', roles: ['administrador', 'atendente'], accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
  { title: 'Receitas', description: 'Prescricoes e ordens', icon: FileText, href: '/dashboard/receitas', roles: ['administrador', 'farmaceutico', 'manipulador'], accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  { title: 'Estoque', description: 'Medicamentos e insumos', icon: Package, href: '/dashboard/estoque', roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'], accent: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
  { title: 'Manipulacao', description: 'Formulas personalizadas', icon: FlaskConical, href: '/dashboard/manipulacao', roles: ['administrador', 'manipulador', 'farmaceutico'], accent: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
  { title: 'Financeiro', description: 'Faturamento e caixa', icon: DollarSign, href: '/dashboard/financeiro', roles: ['administrador', 'financeiro'], accent: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400' },
  { title: 'Relatorios', description: 'Indicadores e metricas', icon: BarChart3, href: '/dashboard/relatorios', roles: ['administrador', 'financeiro', 'farmaceutico'], accent: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
]

const quickActions = [
  { label: 'Novo Paciente', href: '/dashboard/pacientes/cadastro', icon: Users, color: 'bg-blue-500' },
  { label: 'Novo Agendamento', href: '/dashboard/agendamentos/novo', icon: Calendar, color: 'bg-violet-500' },
  { label: 'Nova Receita', href: '/dashboard/receitas/nova', icon: FileText, color: 'bg-emerald-500' },
]

export default function DashboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<{ pacientes: number } | null>(null)
  const [mount, setMount] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const load = async () => {
      const { count } = await createClient().from('pacientes').select('*', { count: 'exact', head: true })
      setStats({ pacientes: count ?? 0 })
    }
    load()
  }, [])

  const allowed = modules.filter((m) => profile?.role && m.roles.includes(profile.role as Role))

  const kpis = [
    {
      label: 'Pacientes', value: stats?.pacientes ?? 0, icon: Users,
      change: '+12% este mes', trend: 'up',
      accent: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400',
      barColor: 'bg-blue-500', barWidth: 'w-3/4',
    },
    {
      label: 'Consultas Hoje', value: 8, icon: Calendar,
      change: '3 restantes', trend: 'neutral',
      accent: 'bg-violet-50 dark:bg-violet-900/20', iconColor: 'text-violet-600 dark:text-violet-400',
      barColor: 'bg-violet-500', barWidth: 'w-1/2',
    },
    {
      label: 'Receitas Pendentes', value: 12, icon: FileText,
      change: '2 urgentes', trend: 'down',
      accent: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400',
      barColor: 'bg-emerald-500', barWidth: 'w-2/3',
    },
    {
      label: 'Alertas Estoque', value: 5, icon: Package,
      change: '3 criticos', trend: 'down',
      accent: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-400',
      barColor: 'bg-amber-500', barWidth: 'w-1/3',
    },
  ]

  const recentAppointments = [
    { time: '08:00', patient: 'Maria Silva', type: 'Consulta', status: 'confirmado' },
    { time: '09:30', patient: 'Joao Santos', type: 'Retorno', status: 'em andamento' },
    { time: '10:00', patient: 'Ana Oliveira', type: 'Exame', status: 'confirmado' },
    { time: '11:30', patient: 'Carlos Lima', type: 'Consulta', status: 'aguardando' },
    { time: '14:00', patient: 'Fernanda Costa', type: 'Retorno', status: 'confirmado' },
  ]

  const stockAlerts = [
    { product: 'Dipirona 500mg', qty: 12, min: 50, severity: 'critical' as const },
    { product: 'Amoxicilina 500mg', qty: 8, min: 30, severity: 'critical' as const },
    { product: 'Paracetamol 750mg', qty: 25, min: 40, severity: 'warning' as const },
    { product: 'Soro Fisiologico 500ml', qty: 18, min: 20, severity: 'warning' as const },
  ]

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const today = new Date()
  const currentDay = today.getDate()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

  return (
    <div className="mx-auto max-w-7xl">
      {/* ─── Welcome Header ─── */}
      <div
        className={`mb-8 transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[30px] font-semibold tracking-tight text-foreground">
              Ola, <span className="text-primary">{profile?.nome?.split(' ')[0]}</span>!
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {profile?.role ? roleLabels[profile.role as Role] : ''} &middot; {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-sm transition-[transform,border-color,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.97]"
                  style={{ transitionTimingFunction: 'var(--ease-out)' }}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── KPI Cards with Accent Bars ─── */}
      <div
        className={`mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-500 delay-75 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="card-accent group relative rounded-xl border border-border bg-card shadow-sm transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.accent}`}>
                    <Icon className={`h-5 w-5 ${kpi.iconColor}`} />
                  </div>
                  <span className={`flex items-center gap-1 text-[12px] font-medium ${
                    kpi.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                    kpi.trend === 'down' ? 'text-rose-600 dark:text-rose-400' :
                    'text-muted-foreground'
                  }`}>
                    {kpi.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                    {kpi.change}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 font-heading text-[28px] font-bold tracking-tight text-foreground">{kpi.value}</p>
              </div>
              {/* Progress bar at bottom */}
              <div className="mx-5 mb-4 h-1.5 rounded-full bg-muted">
                <div className={`h-full rounded-full ${kpi.barColor} transition-all duration-700 ${kpi.barWidth}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── Bento Grid: Activity + Mini Calendar + Recent Appointments + Stock Alerts ─── */}
      <div className="mb-8 grid gap-5 lg:grid-cols-3">
        {/* Activity / Quick Stats — spans 1 column */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[100ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold text-foreground">Atividade</h3>
            <Activity className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'Pacientes hoje', value: 12, icon: Users, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
              { label: 'Receitas emitidas', value: 8, icon: FileText, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
              { label: 'Produtos movimentados', value: 34, icon: Package, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] text-muted-foreground">{item.label}</p>
                    <p className="text-[15px] font-semibold text-foreground">{item.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => router.push('/dashboard/relatorios')}
            className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-[13px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground active:scale-[0.97]"
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            Ver relatorios completos <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mini Calendar — spans 1 column */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[150ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold text-foreground">
              {today.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, m => m.toUpperCase())}
            </h3>
            <Calendar className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-[11px] font-medium text-muted-foreground/50">{day}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === currentDay
              const hasEvent = [3, 8, 12, 15, 19, 22, 27].includes(day)
              return (
                <div
                  key={day}
                  className={`relative flex items-center justify-center py-1 text-[13px] font-medium rounded-lg transition-colors ${
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/70 hover:bg-muted'
                  }`}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary/60" />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-[12px] font-medium text-muted-foreground">Eventos do dia</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[12px] text-blue-700 dark:text-blue-300">08:00 - Consulta: M. Silva</span>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1.5">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
                <span className="text-[12px] text-violet-700 dark:text-violet-300">14:00 - Retorno: F. Costa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Appointments — spans 1 column */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[200ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-[15px] font-semibold text-foreground">Agenda de Hoje</h3>
            <button
              onClick={() => router.push('/dashboard/agendamentos')}
              className="text-[12px] font-medium text-primary transition-colors hover:text-primary/70"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-1">
            {recentAppointments.map((apt) => (
              <div
                key={`${apt.time}-${apt.patient}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
                  {apt.time}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{apt.patient}</p>
                  <p className="text-[11px] text-muted-foreground/60">{apt.type}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  apt.status === 'confirmado' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  apt.status === 'em andamento' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {apt.status}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Stock Alerts + Modules ─── */}
      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        {/* Stock Alerts */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[250ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">Alertas de Estoque</h3>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                {stockAlerts.filter(a => a.severity === 'critical').length} criticos
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard/estoque')}
              className="text-[12px] font-medium text-primary transition-colors hover:text-primary/70"
            >
              Gerenciar
            </button>
          </div>
          <div className="space-y-2">
            {stockAlerts.map((alert) => (
              <div key={alert.product} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  alert.severity === 'critical' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{alert.product}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${alert.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min((alert.qty / alert.min) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${
                      alert.severity === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {alert.qty} / {alert.min}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push('/dashboard/estoque/alertas')}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-[13px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground active:scale-[0.97]"
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            Ver todos os alertas <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick Module Grid — right column */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-500 delay-[300ms] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          <h3 className="mb-4 font-heading text-[15px] font-semibold text-foreground">Modulos Rapidos</h3>
          <div className="grid grid-cols-2 gap-3">
            {allowed.slice(0, 6).map((mod) => {
              const Icon = mod.icon
              return (
                <button
                  key={mod.href}
                  onClick={() => router.push(mod.href)}
                  className="group flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-left transition-[transform,border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-sm active:scale-[0.98]"
                  style={{ transitionTimingFunction: 'var(--ease-out)' }}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${mod.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{mod.title}</p>
                    <p className="text-[11px] text-muted-foreground/60">{mod.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}