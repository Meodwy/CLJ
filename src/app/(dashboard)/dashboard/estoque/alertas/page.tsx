'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Package, CalendarClock, FileWarning, ExternalLink } from 'lucide-react'
import type { Alerta } from '@/lib/supabase/types'

const tipoConfig: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
  estoque_minimo: { label: 'Estoque Mínimo', icon: Package, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  vencido: { label: 'Vencido', icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  vencendo_30: { label: 'Vence em 30 dias', icon: CalendarClock, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  vencendo_60: { label: 'Vence em 60 dias', icon: CalendarClock, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  vencendo_90: { label: 'Vence em 90 dias', icon: CalendarClock, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  lote_zerado: { label: 'Lote Zerado', icon: FileWarning, color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20' },
  divergencia_inventario: { label: 'Divergência', icon: AlertTriangle, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
}

export default function AlertasPage() {
  const [mount, setMount] = useState(false)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const navigateAlerta = (alerta: Alerta) => {
    if (alerta.lote_id) {
      router.push(`/dashboard/estoque/lotes/${alerta.lote_id}`)
    } else if (alerta.produto_id) {
      router.push(`/dashboard/estoque/produtos/${alerta.produto_id}`)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      let query = supabase.from('alertas').select('*').order('created_at', { ascending: false })
      if (filtro) {
        if (filtro === 'nao_lido') query = query.eq('lido', false)
        else query = query.eq('tipo', filtro)
      }
      const { data } = await query
      if (data) setAlertas(data as Alerta[])
      setLoading(false)
    }
    load()
  }, [filtro])

  const marcarLido = async (id: string) => {
    await supabase.from('alertas').update({ lido: true }).eq('id', id)
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a))
  }

  const marcarTodasLidas = async () => {
    await supabase.from('alertas').update({ lido: true }).eq('lido', false)
    setAlertas(prev => prev.map(a => ({ ...a, lido: true })))
  }

  const tiposUnicos = [...new Set(alertas.map(a => a.tipo))]

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">Alertas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {alertas.filter(a => !a.lido).length} não lidos
          </p>
        </div>
        {alertas.some(a => !a.lido) && (
          <button
            onClick={marcarTodasLidas}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors duration-150 ease-[var(--ease-out)] hover:bg-primary/5"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFiltro('')} className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ease-[var(--ease-out)] ${!filtro ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
          Todos
        </button>
        <button onClick={() => setFiltro('nao_lido')} className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ease-[var(--ease-out)] ${filtro === 'nao_lido' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
          Não lidos
        </button>
        {tiposUnicos.map(tipo => (
          <button key={tipo} onClick={() => setFiltro(tipo)} className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ease-[var(--ease-out)] ${filtro === tipo ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
            {tipoConfig[tipo]?.label || tipo}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/40" />
        </div>
      ) : alertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum alerta encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map(alerta => {
            const config = tipoConfig[alerta.tipo] || { label: alerta.tipo, icon: AlertTriangle, color: 'text-muted-foreground bg-muted' }
            const Icon = config.icon
            return (
              <div
                key={alerta.id}
                onClick={() => navigateAlerta(alerta)}
                className={`cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:shadow-md ${alerta.lido ? 'border-border' : 'border-primary/20 ring-1 ring-primary/10'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                      {!alerta.lido && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Novo</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{alerta.mensagem}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {new Date(alerta.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {(alerta.lote_id || alerta.produto_id) && (
                        <><span className="mx-1">•</span><ExternalLink className="h-3 w-3" /> Ver detalhes</>
                      )}
                    </p>
                  </div>
                  {!alerta.lido && (
                    <button
                      onClick={() => marcarLido(alerta.id)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-primary transition-colors duration-150 ease-[var(--ease-out)] hover:bg-primary/5"
                    >
                      Marcar lido
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}