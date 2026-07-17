'use client'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, Bell, ChevronRight } from 'lucide-react'
import { useCallback } from 'react'

const breadcrumbLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'pacientes': 'Pacientes',
  'agendamentos': 'Agendamentos',
  'receitas': 'Receitas',
  'estoque': 'Estoque',
  'manipulacao': 'Manipulacao',
  'financeiro': 'Financeiro',
  'relatorios': 'Relatorios',
  'assistente-ia': 'Assistente IA',
  'configuracoes': 'Configuracoes',
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const segments = pathname.split('/').filter(Boolean)
  const currentSegment = segments[segments.length - 1]
  const pageTitle = breadcrumbLabels[currentSegment] ?? 'Dashboard'

  const navigateBreadcrumb = useCallback((href: string) => {
    router.push(href)
  }, [router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  function getInitials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 lg:px-8">
          {/* Breadcrumb area — hidden on dashboard home to avoid visual duplication */}
          <div className="flex items-center gap-2">
            {segments.length > 1 && (
              <nav className="flex items-center gap-1.5 text-[13px]">
                {segments.map((seg, i) => {
                  const label = breadcrumbLabels[seg] ?? seg
                  const isLast = i === segments.length - 1
                  const href = '/' + segments.slice(0, i + 1).join('/')
                  return (
                    <span key={seg} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
                      {isLast ? (
                        <span className="font-medium text-foreground">{label}</span>
                      ) : (
                        <button
                          onClick={() => navigateBreadcrumb(href)}
                          className="text-muted-foreground/60 transition-colors hover:text-foreground/80"
                        >
                          {label}
                        </button>
                      )}
                    </span>
                  )
                })}
              </nav>
            )}</div>

          {/* Right side: notifications + avatar */}
          <div className="flex items-center gap-3">
            {/* Notification bell with badge */}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/40 transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground/70 active:scale-[0.92]">
              <Bell className="h-[18px] w-[18px] stroke-[1.5]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive shadow-sm" />
            </button>

            {/* User avatar */}
            {profile && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-[13px] font-semibold text-primary shadow-sm">
                {getInitials(profile.nome)}
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}