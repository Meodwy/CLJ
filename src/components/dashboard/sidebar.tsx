'use client'

import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth, type Role } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import {
  LayoutDashboard, Users, Calendar, FileText, Package,
  FlaskConical, DollarSign, BarChart3, Settings, LogOut, HeartPulse,
  Sun, Moon, ChevronLeft,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string; icon: React.ReactNode; href: string; roles: Role[]
}

const roleLabels: Record<Role, string> = {
  administrador: 'Administrador', farmaceutico: 'Farmacêutico', atendente: 'Atendente',
  manipulador: 'Manipulador', estoquista: 'Estoquista', financeiro: 'Financeiro',
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador', 'estoquista', 'financeiro'] },
  { label: 'Pacientes', icon: <Users className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/pacientes', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'] },
  { label: 'Agendamentos', icon: <Calendar className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/agendamentos', roles: ['administrador', 'atendente'] },
  { label: 'Receitas', icon: <FileText className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/receitas', roles: ['administrador', 'farmaceutico', 'manipulador'] },
  { label: 'Estoque', icon: <Package className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/estoque', roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'] },
  { label: 'Manipulação', icon: <FlaskConical className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/manipulacao', roles: ['administrador', 'manipulador', 'farmaceutico'] },
  { label: 'Financeiro', icon: <DollarSign className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/financeiro', roles: ['administrador', 'financeiro'] },
  { label: 'Relatórios', icon: <BarChart3 className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/relatorios', roles: ['administrador', 'financeiro', 'farmaceutico'] },
  { label: 'Configurações', icon: <Settings className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/configuracoes', roles: ['administrador'] },
]

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const allowedItems = navItems.filter((item) => profile?.role && item.roles.includes(profile.role))

  return (
    <aside className={`flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className={`flex h-16 shrink-0 items-center border-b border-border/40 ${collapsed ? 'justify-center' : 'gap-2.5 px-5'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <HeartPulse className="h-[18px] w-[18px] text-primary-foreground" />
        </div>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">CLJ Clínica</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {allowedItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground/80'} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className={isActive ? 'text-primary' : 'text-sidebar-foreground/40'}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse */}
      <div className="border-t border-border/40 px-2 py-2">
        {!collapsed ? (
          <button onClick={() => setCollapsed(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/40 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground/60">
            <ChevronLeft className="h-[18px] w-[18px] stroke-[1.5]" /> Recolher
          </button>
        ) : (
          <button onClick={() => setCollapsed(false)}
            className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground/60">
            <HeartPulse className="h-[18px] w-[18px] stroke-[1.5]" />
          </button>
        )}
      </div>

      {/* User */}
      {profile && (
        <div className="border-t border-border/40 px-2 py-3">
          {!collapsed && (
            <div className="mb-1.5 flex items-center gap-3 px-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">{getInitials(profile.nome)}</div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-sidebar-foreground">{profile.nome}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/50">{roleLabels[profile.role]}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mb-1.5 flex justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">{getInitials(profile.nome)}</div>
            </div>
          )}
          <div className="flex gap-1">
            <button onClick={toggle}
              className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sidebar-foreground/40 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground/60"
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}>
              {theme === 'light' ? <Moon className="h-[18px] w-[18px] stroke-[1.5]" /> : <Sun className="h-[18px] w-[18px] stroke-[1.5]" />}
            </button>
            <button onClick={signOut}
              className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sidebar-foreground/40 transition-all hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-[18px] w-[18px] stroke-[1.5]" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}