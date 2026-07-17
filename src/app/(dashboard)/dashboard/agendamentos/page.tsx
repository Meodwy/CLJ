'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CalendarCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { CalendarGrid } from '@/components/calendar/calendar-grid'
import { AppointmentCard } from '@/components/calendar/appointment-card'
import { AppointmentForm } from '@/components/calendar/appointment-form'
import type { Agendamento } from '@/lib/supabase/types'

// Extended type with joined paciente
type AgendamentoWithPaciente = Agendamento & {
  pacientes: { nome: string } | null
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function AgendamentosPage() {
  const [mount, setMount] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [appointments, setAppointments] = useState<AgendamentoWithPaciente[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Appointment count map for the sidebar
  const appointmentCounts = appointments.reduce<Record<string, number>>((acc, apt) => {
    acc[apt.data] = (acc[apt.data] || 0) + 1
    return acc
  }, {})

  // Selected date appointments
  const selectedDateStr = formatDateKey(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  )
  const selectedAppointments = appointments.filter((apt) => apt.data === selectedDateStr)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0)
      const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, pacientes(nome)')
        .gte('data', firstDay)
        .lte('data', lastDayStr)
        .order('data')
        .order('hora_inicio')

      if (error) throw error
      setAppointments((data as AgendamentoWithPaciente[]) || [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }, [currentMonth, supabase])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('agendamentos').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      toast.success('Status atualizado')
      fetchAppointments()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id)
      if (error) throw error
      toast.success('Agendamento excluído')
      fetchAppointments()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir agendamento')
    }
  }

  const handleEdit = (appointment: any) => {
    setEditingAppointment(appointment)
    setFormOpen(true)
  }

  const handleAppointmentClick = (id: string) => {
    const apt = appointments.find((a) => a.id === id)
    if (apt) {
      setEditingAppointment(apt)
      setFormOpen(true)
    }
  }

  const handleNewAppointment = () => {
    setEditingAppointment(null)
    setFormOpen(true)
  }

  return (
    <div className={cn('space-y-5 transition-all duration-300', mount ? 'opacity-100' : 'opacity-0')}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">Agendamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie a agenda de consultas e procedimentos</p>
        </div>
        <button
          type="button"
          onClick={handleNewAppointment}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </button>
      </div>

      {/* Calendar + Day Layout */}
      <div className="grid gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {/* Calendar - takes 2 cols on lg, 3 on xl */}
        <div className="lg:col-span-2 xl:col-span-3">
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            appointments={appointments}
            onDayClick={setSelectedDate}
            selectedDate={selectedDate}
            onAppointmentClick={handleAppointmentClick}
          />
        </div>

        {/* Mini info card - selected date */}
        <div className="order-first lg:order-last">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="h-4 w-4" />
              <span>
                {WEEKDAY_NAMES[selectedDate.getDay()]},{' '}
                {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
              </span>
            </div>
            <p className="mt-1.5 font-heading text-2xl font-semibold text-foreground">
              {selectedAppointments.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
          </div>
        </div>
      </div>

      {/* Day appointments list */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Agendamentos do dia
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-16">
            <CalendarCheck className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum agendamento neste dia</p>
            <button
              type="button"
              onClick={handleNewAppointment}
              className="mt-3 h-9 rounded-xl bg-primary/10 px-4 text-xs font-medium text-primary hover:bg-primary/20 transition-[background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
            >
              Criar agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedAppointments.map((apt, index) => (
              <div key={apt.id} className={cn(index < 3 && 'animate-slide-up')}>
                <AppointmentCard
                  appointment={apt}
                  onEdit={handleEdit}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Form Dialog */}
      <AppointmentForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingAppointment(null)
        }}
        onSave={fetchAppointments}
        appointment={editingAppointment}
      />
    </div>
  )
}
