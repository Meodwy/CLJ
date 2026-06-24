'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth, type Role } from '@/contexts/auth-context'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Package,
  FlaskConical,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  HeartPulse,
} from 'lucide-react'

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
  roles: Role[]
}

const roleLabels: Record<Role, string> = {
  administrador: 'Administrador',
  farmaceutico: 'Farmacêutico',
  atendente: 'Atendente',
  manipulador: 'Manipulador',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard',
    roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador', 'estoquista', 'financeiro'],
  },
  {
    label: 'Pacientes',
    icon: <Users className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/pacientes',
    roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'],
  },
  {
    label: 'Agendamentos',
    icon: <Calendar className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/agendamentos',
    roles: ['administrador', 'atendente'],
  },
  {
    label: 'Receitas',
    icon: <FileText className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/receitas',
    roles: ['administrador', 'farmaceutico', 'manipulador'],
  },
  {
    label: 'Estoque',
    icon: <Package className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/estoque',
    roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'],
  },
  {
    label: 'Manipulação',
    icon: <FlaskConical className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/manipulacao',
    roles: ['administrador', 'manipulador', 'farmaceutico'],
  },
  {
    label: 'Financeiro',
    icon: <DollarSign className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/financeiro',
    roles: ['administrador', 'financeiro'],
  },
  {
    label: 'Relatórios',
    icon: <BarChart3 className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/relatorios',
    roles: ['administrador', 'financeiro', 'farmaceutico'],
  },
  {
    label: 'Configurações',
    icon: <Settings className="h-[18px] w-[18px] stroke-[1.5]" />,
    href: '/dashboard/configuracoes',
    roles: ['administrador'],
  },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const allowedItems = navItems.filter(
    (item) => profile?.role && item.roles.includes(profile.role)
  )

  return (
    <aside className="flex w-[240px] flex-col border-r border-border/60 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/40 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <HeartPulse className="h-[18px] w-[18px] text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">CLJ Clínica</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {allowedItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground/80'
              }`}
            >
              <span className={isActive ? 'text-foreground' : 'text-muted-foreground/50'}>
                {item.icon}
              </span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User */}
      {profile && (
        <div className="border-t border-border/40 px-3 py-3">
          <div className="mb-1.5 flex items-center gap-3 px-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
              {getInitials(profile.nome)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">{profile.nome}</p>
              <p className="truncate text-[11px] text-muted-foreground/60">{roleLabels[profile.role]}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground/50 transition-all duration-150 hover:bg-destructive/8 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px] stroke-[1.5]" />
            Sair
          </button>
        </div>
      )}
    </aside>
  )
}