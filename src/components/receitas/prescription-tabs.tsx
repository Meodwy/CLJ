'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { STATUS_GROUPS } from '@/lib/receitas/types'
import { PrescriptionCard, type PrescriptionCardData } from './prescription-card'

const TAB_LABELS: Record<string, string> = {
  todas: 'Todas',
  pendentes: 'Pendentes',
  em_conferencia: 'Em conferencia',
  com_pendencia: 'Com pendencia',
  aprovadas: 'Aprovadas',
  arquivadas: 'Arquivadas',
  rejeitadas: 'Rejeitadas',
  substituidas: 'Substituidas',
  canceladas: 'Canceladas',
  retencao_legal: 'Retencao legal',
}

interface PrescriptionTabsProps {
  className?: string
}

export function PrescriptionTabs({ className }: PrescriptionTabsProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState('todas')

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // Força refresh do token antes de usar
      await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/receitas', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Erro ao carregar receitas')
      const data = await res.json()
      // Accept array or { data: [...] } shape
      const list = Array.isArray(data) ? data : data.data ?? []
      setPrescriptions(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrescriptions()
  }, [fetchPrescriptions])

  const tabs = ['todas', ...Object.keys(STATUS_GROUPS)]

  const filtered = tabValue === 'todas'
    ? prescriptions
    : prescriptions.filter((p) => (STATUS_GROUPS[tabValue] || []).includes(p.status))

  return (
    <TabsPrimitive.Root
      value={tabValue}
      onValueChange={(v) => setTabValue(v as string)}
      className={cn('w-full', className)}
    >
      <TabsPrimitive.List className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map((tab) => (
          <TabsPrimitive.Tab
            key={tab}
            value={tab}
            className={cn(
              'shrink-0 rounded-t-sm px-3 py-2 text-[13px] font-medium outline-none',
              'text-muted-foreground/60 hover:text-foreground',
              'data-[selected]:text-foreground data-[selected]:border-b-2 data-[selected]:border-primary',
              'focus-visible:ring-2 focus-visible:ring-ring/50',
              'transition-[color,border-color] duration-150 ease-[var(--ease-out)]'
            )}
          >
            {TAB_LABELS[tab] || tab}
          </TabsPrimitive.Tab>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Panel key={tab} value={tab} className="pt-4 outline-none transition-[opacity] duration-150 ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-sm text-destructive">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground/20" />
              {tab === 'todas' ? 'Nenhuma receita encontrada' : `Nenhuma receita ${TAB_LABELS[tab]?.toLowerCase() || tab}`}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((prescription) => (
                <PrescriptionCard key={prescription.id} prescription={prescription} />
              ))}
            </div>
          )}
        </TabsPrimitive.Panel>
      ))}
    </TabsPrimitive.Root>
  )
}
