'use client'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Loader2, Bell } from 'lucide-react'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()

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
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-medium text-foreground/70">Dashboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground/70">
              <Bell className="h-[18px] w-[18px] stroke-[1.5]" />
            </button>
            {profile && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-semibold text-primary">
                {getInitials(profile.nome)}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
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