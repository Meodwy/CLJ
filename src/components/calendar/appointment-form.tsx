'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/lib/supabase/types'

const appointmentSchema = z.object({
  paciente_id: z.string().min(1, 'Selecione um paciente'),
  data: z.string().min(1, 'Selecione uma data'),
  hora_inicio: z.string().min(1, 'Informe o horário de início'),
  hora_fim: z.string().optional(),
  tipo_consulta: z.string().min(1, 'Selecione o tipo'),
  status: z.string().min(1, 'Selecione o status'),
  observacao: z.string().optional(),
})

type AppointmentFormData = z.infer<typeof appointmentSchema>

const TIPO_OPTIONS = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'exame', label: 'Exame' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'urgencia', label: 'Urgência' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_OPTIONS = [
  { value: 'agendado', label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'faltou', label: 'Faltou' },
]

interface AppointmentFormProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  appointment?: any
}

export function AppointmentForm({ open, onClose, onSave, appointment }: AppointmentFormProps) {
  const [mount, setMount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [pacienteDropdownOpen, setPacienteDropdownOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const supabase = createClient()

  const [formData, setFormData] = useState<AppointmentFormData>({
    paciente_id: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
    tipo_consulta: 'consulta',
    status: 'agendado',
    observacao: '',
  })

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  // Load pacientes
  useEffect(() => {
    async function loadPacientes() {
      const { data } = await supabase.from('pacientes').select('*').order('nome')
      if (data) setPacientes(data)
    }
    if (open) loadPacientes()
  }, [open, supabase])

  // Populate form when editing
  useEffect(() => {
    if (appointment) {
      setFormData({
        paciente_id: appointment.paciente_id || '',
        data: appointment.data || '',
        hora_inicio: appointment.hora_inicio || '',
        hora_fim: appointment.hora_fim || '',
        tipo_consulta: appointment.tipo_consulta || 'consulta',
        status: appointment.status || 'agendado',
        observacao: appointment.observacao || '',
      })
      if (appointment.pacientes) {
        setPacienteSearch(appointment.pacientes.nome || '')
      }
    } else {
      setFormData({
        paciente_id: '',
        data: '',
        hora_inicio: '',
        hora_fim: '',
        tipo_consulta: 'consulta',
        status: 'agendado',
        observacao: '',
      })
      setPacienteSearch('')
    }
    setErrors({})
  }, [appointment, open])

  const filteredPacientes = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(pacienteSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = appointmentSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      if (appointment?.id) {
        const { error } = await supabase
          .from('agendamentos')
          .update({
            paciente_id: formData.paciente_id,
            data: formData.data,
            hora_inicio: formData.hora_inicio,
            hora_fim: formData.hora_fim || null,
            tipo_consulta: formData.tipo_consulta,
            status: formData.status,
            observacao: formData.observacao || null,
          })
          .eq('id', appointment.id)

        if (error) throw error
        toast.success('Agendamento atualizado com sucesso')
      } else {
        const { error } = await supabase.from('agendamentos').insert({
          paciente_id: formData.paciente_id,
          data: formData.data,
          hora_inicio: formData.hora_inicio,
          hora_fim: formData.hora_fim || null,
          tipo_consulta: formData.tipo_consulta,
          status: formData.status,
          observacao: formData.observacao || null,
        })

        if (error) throw error
        toast.success('Agendamento criado com sucesso')
      }

      onSave()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar agendamento')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const selectedPaciente = pacientes.find((p) => p.id === formData.paciente_id)

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-[var(--ease-out)]',
          mount ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-[var(--ease-out)]',
          mount ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          className={cn(
            'relative z-50 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl',
            mount ? 'animate-scale-in' : '',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {appointment?.id ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors duration-150 ease-[var(--ease-out)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paciente - searchable select */}
            <div className="relative">
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Paciente
              </label>
              <div
                className={cn(
                  'flex h-[46px] cursor-pointer items-center rounded-xl border border-border/80 bg-background px-4 text-[15px]',
                  errors.paciente_id && 'border-destructive',
                )}
                onClick={() => setPacienteDropdownOpen(!pacienteDropdownOpen)}
              >
                {selectedPaciente ? (
                  <span className="text-foreground">{selectedPaciente.nome}</span>
                ) : (
                  <span className="text-muted-foreground">Selecione um paciente</span>
                )}
              </div>
              {errors.paciente_id && (
                <p className="mt-1 text-xs text-destructive">{errors.paciente_id}</p>
              )}
              {pacienteDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPacienteDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-scale-in">
                    <div className="border-b border-border p-2">
                      <input
                        value={pacienteSearch}
                        onChange={(e) => setPacienteSearch(e.target.value)}
                        placeholder="Buscar paciente..."
                        className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[13px] outline-none focus:border-primary/40"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredPacientes.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          Nenhum paciente encontrado
                        </p>
                      ) : (
                        filteredPacientes.map((paciente) => (
                          <button
                            key={paciente.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center px-3.5 py-2.5 text-left text-[13px] transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted',
                              formData.paciente_id === paciente.id && 'bg-muted font-medium',
                            )}
                            onClick={() => {
                              setFormData({ ...formData, paciente_id: paciente.id })
                              setPacienteSearch(paciente.nome)
                              setPacienteDropdownOpen(false)
                            }}
                          >
                            {paciente.nome}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Data e Horários - grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Data
                </label>
                <input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className={cn(
                    'h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]',
                    errors.data && 'border-destructive',
                  )}
                />
                {errors.data && (
                  <p className="mt-1 text-xs text-destructive">{errors.data}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Início
                </label>
                <input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                  className={cn(
                    'h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]',
                    errors.hora_inicio && 'border-destructive',
                  )}
                />
                {errors.hora_inicio && (
                  <p className="mt-1 text-xs text-destructive">{errors.hora_inicio}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Fim
                </label>
                <input
                  type="time"
                  value={formData.hora_fim}
                  onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                  className="h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]"
                />
              </div>
            </div>

            {/* Tipo e Status - grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Tipo de Consulta
                </label>
                <select
                  value={formData.tipo_consulta}
                  onChange={(e) => setFormData({ ...formData, tipo_consulta: e.target.value })}
                  className={cn(
                    'h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]',
                    errors.tipo_consulta && 'border-destructive',
                  )}
                >
                  {TIPO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.tipo_consulta && (
                  <p className="mt-1 text-xs text-destructive">{errors.tipo_consulta}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={cn(
                    'h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]',
                    errors.status && 'border-destructive',
                  )}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.status && (
                  <p className="mt-1 text-xs text-destructive">{errors.status}</p>
                )}
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                Observação
              </label>
              <textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/80 bg-background px-4 py-3 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-[46px] rounded-xl border border-border/80 bg-background px-6 text-[15px] font-medium text-foreground hover:bg-muted transition-colors duration-150 ease-[var(--ease-out)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex h-[46px] items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-medium text-primary-foreground hover:opacity-90 transition-opacity duration-150 ease-[var(--ease-out)] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {appointment?.id ? 'Atualizar' : 'Agendar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}