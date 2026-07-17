'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Edit3, Trash2, CheckCircle2, XCircle, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppointmentCardProps {
  appointment: {
    id: string
    hora_inicio: string
    hora_fim: string | null
    tipo_consulta: string | null
    status: string
    observacao: string | null
    pacientes: { nome: string } | null
  }
  onEdit: (appointment: any) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  agendado: {
    label: 'Agendado',
    dot: 'bg-blue-500',
  },
  confirmado: {
    label: 'Confirmado',
    dot: 'bg-green-500',
  },
  realizado: {
    label: 'Realizado',
    dot: 'bg-emerald-500',
  },
  cancelado: {
    label: 'Cancelado',
    dot: 'bg-gray-400',
  },
  faltou: {
    label: 'Faltou',
    dot: 'bg-red-500',
  },
}

const STATUS_ACTIONS = [
  { value: 'confirmado', label: 'Confirmar', icon: CheckCircle2 },
  { value: 'realizado', label: 'Realizar', icon: CheckCircle2 },
  { value: 'cancelado', label: 'Cancelar', icon: XCircle },
  { value: 'faltou', label: 'Faltou', icon: Ban },
]

const TIPO_LABELS: Record<string, string> = {
  consulta: 'Consulta',
  retorno: 'Retorno',
  exame: 'Exame',
  procedimento: 'Procedimento',
  urgencia: 'Urgência',
  outro: 'Outro',
}

export function AppointmentCard({ appointment, onEdit, onStatusChange, onDelete }: AppointmentCardProps) {
  const [mount, setMount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!menuOpen) setMenuPos(null)
  }, [menuOpen])

  const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.agendado
  const tipoLabel = TIPO_LABELS[appointment.tipo_consulta?.toLowerCase() || ''] || appointment.tipo_consulta || '--'

  const availableActions = STATUS_ACTIONS.filter((a) => a.value !== appointment.status)

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl bg-card p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]',
        'transition-[transform,box-shadow,opacity] duration-200 ease-[var(--ease-out)] hover:-translate-y-[1px] hover:shadow-[0_3px_8px_0_rgb(0_0_0/0.06)]',
        'motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none',
        mount ? 'opacity-100' : 'opacity-0',
      )}
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {/* Time column */}
      <div className="flex shrink-0 flex-col items-center pt-0.5">
        <span className="font-heading text-sm font-semibold text-foreground">{appointment.hora_inicio.slice(0, 5)}</span>
        {appointment.hora_fim && (
          <span className="text-[10px] text-muted-foreground">{appointment.hora_fim.slice(0, 5)}</span>
        )}
      </div>

      {/* Divider */}
      <div className="flex shrink-0 flex-col items-center pt-1">
        <div className={cn('h-2 w-2 rounded-full', status.dot)} />
        <div className="mt-0.5 h-full w-px bg-border/50" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-medium text-foreground">
              {appointment.pacientes?.nome || 'Paciente não identificado'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tipoLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status dot + label */}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>

            {/* Menu */}
            <div className="relative">
              <button
                ref={btnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!menuOpen && btnRef.current) {
                    const rect = btnRef.current.getBoundingClientRect()
                    const menuH = 200 // approximate menu height in px
                    const spaceBelow = window.innerHeight - rect.bottom
                    const top = spaceBelow >= menuH
                      ? rect.bottom + 4
                      : rect.top - menuH
                    setMenuPos({ top, right: window.innerWidth - rect.right })
                  }
                  setMenuOpen(!menuOpen)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-[transform,background-color] duration-150 ease-[var(--ease-out)] active:scale-[0.92]"
                style={{ transitionTimingFunction: 'var(--ease-out)' }}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              {menuOpen && menuPos && createPortal(
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="fixed z-50 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg animate-scale-in"
                    style={{ top: menuPos.top, right: menuPos.right }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onEdit(appointment)
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground hover:bg-muted transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                      Editar
                    </button>
                    {availableActions.map((action) => (
                      <button
                        key={action.value}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onStatusChange(appointment.id, action.value)
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground hover:bg-muted transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                      >
                        <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {action.label}
                      </button>
                    ))}
                    <div className="mx-3 my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onDelete(appointment.id)
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>
        </div>

        {appointment.observacao && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/70 italic">
            {appointment.observacao}
          </p>
        )}
      </div>
    </div>
  )
}