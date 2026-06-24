'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Users, Calendar, FileText, Package, FlaskConical, DollarSign, BarChart3, TrendingUp, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Role = 'administrador' | 'farmaceutico' | 'atendente' | 'manipulador' | 'estoquista' | 'financeiro'
const roleLabels: Record<Role, string> = { administrador: 'Administrador', farmaceutico: 'Farmacêutico', atendente: 'Atendente', manipulador: 'Manipulador', estoquista: 'Estoquista', financeiro: 'Financeiro' }

interface ModuleCard { title: string; description: string; icon: LucideIcon; href: string; roles: Role[]; accent: string }
const modules: ModuleCard[] = [
  { title: 'Pacientes', description: 'Cadastro e gestão', icon: Users, href: '/dashboard/pacientes', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'], accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
  { title: 'Agendamentos', description: 'Agenda de horários', icon: Calendar, href: '/dashboard/agendamentos', roles: ['administrador', 'atendente'], accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
  { title: 'Receitas', description: 'Prescrições e ordens', icon: FileText, href: '/dashboard/receitas', roles: ['administrador', 'farmaceutico', 'manipulador'], accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  { title: 'Estoque', description: 'Medicamentos e insumos', icon: Package, href: '/dashboard/estoque', roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'], accent: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
  { title: 'Manipulação', description: 'Fórmulas personalizadas', icon: FlaskConical, href: '/dashboard/manipulacao', roles: ['administrador', 'manipulador', 'farmaceutico'], accent: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
  { title: 'Financeiro', description: 'Faturamento e caixa', icon: DollarSign, href: '/dashboard/financeiro', roles: ['administrador', 'financeiro'], accent: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400' },
  { title: 'Relatórios', description: 'Indicadores e métricas', icon: BarChart3, href: '/dashboard/relatorios', roles: ['administrador', 'financeiro', 'farmaceutico'], accent: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
]

export default function DashboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<{ pacientes: number } | null>(null)
  const [mount, setMount] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => { const load = async () => { const { count } = await createClient().from('pacientes').select('*', { count: 'exact', head: true }); setStats({ pacientes: count ?? 0 }) }; load() }, [])

  const allowed = modules.filter((m) => profile?.role && m.roles.includes(profile.role as Role))
  const kpis = [
    { label: 'Total de Pacientes', value: stats?.pacientes ?? 0, icon: Users, change: '+12%', accent: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Consultas Hoje', value: '—', icon: Calendar, change: '', accent: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
    { label: 'Receitas Pendentes', value: '—', icon: FileText, change: '', accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Produtos Estoque', value: '—', icon: Package, change: '', accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className={`transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <h1 className="text-[30px] font-semibold tracking-tight text-foreground">Olá, {profile?.nome?.split(' ')[0]}!</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{profile?.role ? roleLabels[profile.role as Role] : ''} &middot; Bem-vindo ao sistema da clínica</p>
      </div>

      <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-500 delay-75 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${kpi.accent}`}><Icon className="h-5 w-5" /></div>
              <p className="text-[13px] font-medium text-muted-foreground">{kpi.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[30px] font-bold tracking-tight text-foreground">{kpi.value}</span>
                {kpi.change && <span className="flex items-center gap-0.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3.5 w-3.5" />{kpi.change}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div>
        <h2 className="mb-5 text-xl font-semibold tracking-tight text-foreground">Módulos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allowed.map((mod, i) => {
            const Icon = mod.icon
            return (
              <button key={mod.href} onClick={() => router.push(mod.href)}
                className={`group text-left transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
                style={{ transitionDelay: `${100 + i * 60}ms` }}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${mod.accent} transition-transform group-hover:scale-110`}><Icon className="h-5 w-5" /></div>
                  <h3 className="text-[15px] font-semibold text-foreground">{mod.title}</h3>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{mod.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}