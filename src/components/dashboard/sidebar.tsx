'use client'

import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useAuth, type Role } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import {
  LayoutDashboard, Users, Calendar, FileText, Package,
  FlaskConical, DollarSign, BarChart3, Settings, LogOut, HeartPulse,
  Sun, Moon, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string; icon: React.ReactNode; href: string; roles: Role[]
}

const roleLabels: Record<Role, string> = {
  administrador: 'Administrador', farmaceutico: 'Farmaceutico', atendente: 'Atendente',
  manipulador: 'Manipulador', estoquista: 'Estoquista', financeiro: 'Financeiro',
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador', 'estoquista', 'financeiro'] },
  { label: 'Pacientes', icon: <Users className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/pacientes', roles: ['administrador', 'farmaceutico', 'atendente', 'manipulador'] },
  { label: 'Agendamentos', icon: <Calendar className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/agendamentos', roles: ['administrador', 'atendente'] },
  { label: 'Receitas', icon: <FileText className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/receitas', roles: ['administrador', 'farmaceutico', 'manipulador'] },
  { label: 'Estoque', icon: <Package className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/estoque', roles: ['administrador', 'farmaceutico', 'estoquista', 'manipulador'] },
  { label: 'Manipulacao', icon: <FlaskConical className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/manipulacao', roles: ['administrador', 'manipulador', 'farmaceutico'] },
  { label: 'Financeiro', icon: <DollarSign className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/financeiro', roles: ['administrador', 'financeiro'] },
  { label: 'Relatorios', icon: <BarChart3 className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/relatorios', roles: ['administrador', 'financeiro', 'farmaceutico'] },
  { label: 'Configuracoes', icon: <Settings className="h-[18px] w-[18px] stroke-[1.5]" />, href: '/dashboard/configuracoes', roles: ['administrador'] },
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
    <aside
      className={`relative flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${collapsed ? 'w-[56px]' : 'w-[240px]'}`}
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {/* Logo Area — more prominent */}
      <div className={`flex h-16 shrink-0 items-center border-b border-border/50 ${collapsed ? 'justify-center' : 'gap-3 px-5'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm">
          <HeartPulse className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="block text-[15px] font-semibold tracking-tight text-sidebar-foreground">CLJ Clinica</span>
            <span className="block text-[10px] font-medium tracking-wider text-sidebar-foreground/35 uppercase">Sistema de Gestao</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {allowedItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                collapsed ? 'justify-center px-0' : ''
              } ${isActive
                ? 'text-primary'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'
              }`}
              style={{ transitionTimingFunction: 'var(--ease-out)' }}
              title={collapsed ? item.label : undefined}
            >
              {/* Active gradient accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary via-primary/80 to-primary/60" />
              )}
              {/* Active background glow */}
              {isActive && (
                <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/8 to-transparent" />
              )}
              {/* Icon with hover effect */}
              <span className={`relative z-10 shrink-0 transition-all duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-sidebar-foreground/35'
              }`}>
                {item.icon}
              </span>
              {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-border/50 px-2 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-sidebar-foreground/35 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/60"
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
        >
          {collapsed ? (
            <ChevronRight className="h-[16px] w-[16px] stroke-[1.5]" />
          ) : (
            <>
              <ChevronLeft className="h-[16px] w-[16px] stroke-[1.5]" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>

      {/* User Section — polished */}
      {profile && (
        <div className="border-t border-border/50 px-2 py-3">
          {!collapsed && (
            <div className="mb-2.5 flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-[12px] font-semibold text-primary shadow-sm">
                {getInitials(profile.nome)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">{profile.nome}</p>
                <p className="truncate text-[11px] leading-tight text-sidebar-foreground/40">{roleLabels[profile.role]}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mb-2 flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-[12px] font-semibold text-primary shadow-sm">
                {getInitials(profile.nome)}
              </div>
            </div>
          )}
          <div className={`flex ${collapsed ? 'flex-col gap-2' : 'flex-row gap-1.5'}`}>
            <button
              onClick={toggle}
              className={`flex items-center justify-center gap-2 rounded-lg transition-[background-color,color] duration-150 ease-[var(--ease-out)] hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/60 text-sidebar-foreground/35 ${collapsed ? 'w-full px-0 py-2' : 'flex-1 px-3 py-2'}`}
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {theme === 'light' ? <Moon className="h-[16px] w-[16px] stroke-[1.5]" /> : <Sun className="h-[16px] w-[16px] stroke-[1.5]" />}
              {!collapsed && <span className="text-[12px]">{theme === 'light' ? 'Escuro' : 'Claro'}</span>}
            </button>
            <button
              onClick={signOut}
              className={`flex items-center justify-center gap-2 rounded-lg transition-[background-color,color] duration-150 ease-[var(--ease-out)] hover:bg-destructive/10 hover:text-destructive text-sidebar-foreground/35 ${collapsed ? 'w-full px-0 py-2' : 'flex-1 px-3 py-2'}`}
              title="Sair"
            >
              <LogOut className="h-[16px] w-[16px] stroke-[1.5]" />
              {!collapsed && <span className="text-[12px]">Sair</span>}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}