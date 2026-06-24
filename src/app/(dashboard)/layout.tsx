'use client'

import { AuthProvider, useAuth } from '@/contexts/auth-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { Loader2, Search, Bell } from 'lucide-react'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FB]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      <DashboardSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-white px-6">
          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
            <input
              type="search"
              placeholder="Buscar..."
              className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 pl-9 pr-3 text-[13px] text-foreground outline-none transition-all duration-150 placeholder:text-muted-foreground/30 focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.06)]"
            />
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground">
              <Bell className="h-[18px] w-[18px] stroke-[1.5]" />
            </button>
            {profile && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-[12px] font-semibold text-muted-foreground">
                {getInitials(profile.nome)}
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}