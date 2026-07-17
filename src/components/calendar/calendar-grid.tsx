'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppointmentSummary {
  id: string
  data: string
  hora_inicio: string
  pacientes: { nome: string } | null
  status: string
}

interface CalendarGridProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  appointments: AppointmentSummary[]
  onDayClick: (date: Date) => void
  selectedDate: Date
  onAppointmentClick: (id: string) => void
}

const DAY_HEADERS = ['Dom', 'S', 'T', 'Q', 'Qui', 'S', 'S']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay()

  const days: (number | null)[] = []

  for (let i = 0; i < startWeekday; i++) {
    days.push(null)
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let i = 0; i < remaining; i++) {
      days.push(null)
    }
  }

  return days
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const STATUS_CHIP_COLORS: Record<string, string> = {
  agendado: 'bg-blue-500/85',
  confirmado: 'bg-green-500/85',
  cancelado: 'bg-gray-400/70',
  realizado: 'bg-emerald-500/85',
  faltou: 'bg-red-500/80',
}

export function CalendarGrid({
  currentMonth,
  onMonthChange,
  appointments,
  onDayClick,
  selectedDate,
  onAppointmentClick,
}: CalendarGridProps) {
  const [mount, setMount] = useState(false)
  const today = new Date()
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const selectedStr = formatDateKey(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  )

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const days = getMonthDays(year, month)

  const getAppointmentsForDay = useCallback(
    (dateKey: string) => {
      return appointments.filter((apt) => apt.data === dateKey)
    },
    [appointments],
  )

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  const prevMonth = () => onMonthChange(new Date(year, month - 1, 1))
  const nextMonth = () => onMonthChange(new Date(year, month + 1, 1))

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card p-5 shadow-sm transition-opacity duration-300',
        mount ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-[transform,background-color] duration-150 ease-[var(--ease-out)] active:scale-[0.92]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {monthNames[month]} {year}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-[transform,background-color] duration-150 ease-[var(--ease-out)] active:scale-[0.92]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-2 grid grid-cols-7 gap-px">
        {DAY_HEADERS.map((header, i) => (
          <div
            key={`${header}-${i}`}
            className={cn(
              'py-2 text-center text-[11px] font-medium uppercase tracking-widest',
              i === 0 || i === 6
                ? 'text-muted-foreground/50'
                : 'text-muted-foreground/60',
            )}
          >
            {header}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-[4/3]"
              />
            )
          }

          const dateKey = formatDateKey(year, month, day)
          const isToday = dateKey === todayStr
          const isSelected = dateKey === selectedStr
          const weekend = index % 7 === 0 || index % 7 === 6
          const dayAppointments = getAppointmentsForDay(dateKey)
          const visibleAppts = dayAppointments.slice(0, 3)
          const remaining = dayAppointments.length - 3

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDayClick(new Date(year, month, day))}
              className={cn(
                'group relative flex flex-col items-start rounded-lg p-1.5 text-sm',
                'transition-[transform,opacity] duration-200 ease-[var(--ease-out)]',
                'hover:z-10 hover:scale-[1.02]',
                'active:scale-[0.97]',
                'motion-reduce:hover:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              )}
            >
              {/* Cell background layer */}
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 rounded-lg',
                  isSelected && 'ring-2 ring-primary/30 bg-primary/[0.04]',
                  !isSelected && isToday && 'bg-primary/[0.04]',
                  !isSelected && !isToday && !weekend && 'hover:bg-muted/40',
                  !isSelected && !isToday && weekend && 'bg-muted/20',
                )}
              />

              {/* Day number */}
              <div className="relative z-[1] mb-auto flex w-full items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[13px] leading-none',
                    isToday && !isSelected
                      ? 'bg-primary text-primary-foreground text-xs font-semibold'
                      : 'font-medium text-foreground',
                  )}
                >
                  {day}
                </span>
              </div>

              {/* Appointment chips */}
              <div className="relative z-[1] mt-auto w-full space-y-[2px]">
                {visibleAppts.map((apt) => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAppointmentClick(apt.id)
                    }}
                    className={cn(
                      'flex items-center gap-1 rounded-[4px] px-1.5 py-[1.5px]',
                      'text-[10px] leading-tight text-white font-medium',
                      'cursor-pointer truncate',
                      'hover:opacity-80 transition-opacity duration-150',
                      STATUS_CHIP_COLORS[apt.status] || 'bg-primary/80',
                    )}
                    title={`${apt.pacientes?.nome || '--'} as ${apt.hora_inicio?.slice(0, 5)}`}
                  >
                    <span className="shrink-0 opacity-80">
                      {apt.hora_inicio?.slice(0, 5)}
                    </span>
                    <span className="truncate">{apt.pacientes?.nome || '--'}</span>
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="px-1.5 text-[10px] font-medium text-muted-foreground">
                    +{remaining} mais
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
