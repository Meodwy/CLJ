'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import {
  Users,
  Calendar,
  FileText,
  Package,
  FlaskConical,
  DollarSign,
  BarChart3,
  UserPlus,
  Clock,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────

type Role = 'administrador' | 'farmaceutico' | 'atendente' | 'manipulador' | 'estoquista' | 'financeiro'

const roleLabels: Record<Role, string> = {
  administrador: 'Administrador',
  farmaceutico: 'Farmacêutico',
  atendente: 'Atendente',
  manipulador: 'Manipulador',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
}

interface ModuleCard {
  title: string
  description: string
  icon: LucideIcon
  href: string
  roles: Role[]
  accent: string
}

const modules: ModuleCard[] = [
  {
    title: 'Pacientes', description: 'Cadastro e gestão de pacientes',
    icon: Users, href: '/dashboard/pacientes',
    roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'],
    accent: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Agendamentos', description: 'Agenda de consultas e horários',
    icon: Calendar, href: '/dashboard/agendamentos',
    roles: ['administrador', 'atendente'],
    accent: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Receitas', description: 'Prescrições e ordens médicas',
    icon: FileText, href: '/dashboard/receitas',
    roles: ['administrador', 'farmaceutico', 'manipulador'],
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Estoque', description: 'Controle de medicamentos e insumos',
    icon: Package, href: '/dashboard/estoque',
    roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'],
    accent: 'bg-amber-50 text-amber-600',
  },
  {
    title: 'Manipulação', description: 'Ordens de manipulação e fórmulas',
    icon: FlaskConical, href: '/dashboard/manipulacao',
    roles: ['administrador', 'manipulador', 'farmaceutico'],
    accent: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Financeiro', description: 'Faturamento e contas a receber',
    icon: DollarSign, href: '/dashboard/financeiro',
    roles: ['administrador', 'financeiro'],
    accent: 'bg-cyan-50 text-cyan-600',
  },
  {
    title: 'Relatórios', description: 'Relatórios e indicadores',
    icon: BarChart3, href: '/dashboard/relatorios',
    roles: ['administrador', 'financeiro', 'farmaceutico'],
    accent: 'bg-indigo-50 text-indigo-600',
  },
]

// ─── Skeleton ──────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/60 ${className}`} />
}

// ─── Main ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<{ pacientes: number } | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const loadStats = async () => {
      const supabase = createClient()
      const { count } = await supabase.from('pacientes').select('*', { count: 'exact', head: true })
      setStats({ pacientes: count ?? 0 })
      setStatsLoading(false)
    }
    loadStats()
  }, [])

  const allowedModules = modules.filter(
    (m) => profile?.role && m.roles.includes(profile.role as Role)
  )

  const kpis = [
    {
      label: 'Total de Pacientes',
      value: stats?.pacientes ?? 0,
      icon: Users,
      change: '+12%',
      accent: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Consultas Hoje',
      value: '—',
      icon: Calendar,
      change: '',
      accent: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Novos (30 dias)',
      value: '—',
      icon: UserPlus,
      change: '',
      accent: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Agendados',
      value: '—',
      icon: Clock,
      change: '',
      accent: 'text-amber-600 bg-amber-50',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* ─── Page Title ──────────────────────── */}
      <div className={`transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#111827]">
          Olá, {profile?.nome?.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          {profile?.role ? roleLabels[profile.role as Role] : ''} &middot; Bem-vindo ao sistema da clínica
        </p>
      </div>

      {/* ─── KPI Cards ───────────────────────── */}
      <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-500 delay-75 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-[#ECEEF2] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <Skeleton className="mb-4 h-10 w-10 rounded-xl" />
              <Skeleton className="mb-1.5 h-4 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          ))
        ) : (
          kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="rounded-3xl border border-[#ECEEF2] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${kpi.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-[13px] font-medium text-[#6B7280]">{kpi.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[32px] font-bold tracking-tight text-[#111827]">{kpi.value}</span>
                  {kpi.change && (
                    <span className="flex items-center gap-0.5 text-[13px] font-medium text-emerald-600">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {kpi.change}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── Modules ─────────────────────────── */}
      <div>
        <h2 className="mb-6 text-[20px] font-semibold tracking-tight text-[#111827]">Módulos</h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allowedModules.map((mod, index) => {
            const Icon = mod.icon
            const delay = 100 + index * 60
            return (
              <button
                key={mod.href}
                onClick={() => router.push(mod.href)}
                className={`group text-left transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
                style={{ transitionDelay: `${delay}ms` }}
              >
                <div className="rounded-3xl border border-[#ECEEF2] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] active:scale-[0.98]">
                  <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${mod.accent} transition-transform duration-200 group-hover:scale-105`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111827] transition-colors duration-200 group-hover:text-primary">
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[#6B7280]">
                    {mod.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}