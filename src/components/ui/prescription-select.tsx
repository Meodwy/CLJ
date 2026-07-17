'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Check, ChevronDown, Search } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/receitas/types'

interface PrescriptionOption {
  id: string
  prescriber_name: string
  prescription_type: string
  document_origin: string
  status: string
  patient_nome: string | null
  current_version_id: string | null
  created_at: string
}

interface PrescriptionSelectProps {
  value: string
  onChange: (id: string, currentVersionId: string | null) => void
  patientId?: string | null
  label?: string
  placeholder?: string
  required?: boolean
  error?: string | null
}

export function PrescriptionSelect({
  value,
  onChange,
  patientId,
  label = 'Receita',
  placeholder = 'Buscar receita pelo prescritor ou paciente...',
  required = false,
  error,
}: PrescriptionSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [prescriptions, setPrescriptions] = useState<PrescriptionOption[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    let q = supabase
      .from('prescriptions')
      .select(`
        id, prescriber_name, prescription_type, document_origin, status, current_version_id, created_at,
        patient:pacientes(nome)
      `)
      .eq('status', 'APROVADA')

    if (patientId) {
      q = q.eq('patient_id', patientId)
    }

    q
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (!err && data) {
          const mapped = data.map((rx: Record<string, unknown>) => ({
            id: rx.id as string,
            prescriber_name: rx.prescriber_name as string,
            prescription_type: rx.prescription_type as string,
            document_origin: rx.document_origin as string,
            status: rx.status as string,
            current_version_id: rx.current_version_id as string | null,
            patient_nome: ((rx.patient as Record<string, unknown> | null)?.nome as string | null) ?? null,
            created_at: rx.created_at as string,
          }))
          setPrescriptions(mapped)
        }
        setLoading(false)
      })
  }, [patientId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query
    ? prescriptions.filter(
        (p) =>
          p.prescriber_name.toLowerCase().includes(query.toLowerCase()) ||
          (p.patient_nome && p.patient_nome.toLowerCase().includes(query.toLowerCase())),
      )
    : prescriptions

  const handleSelect = useCallback(
    (rx: PrescriptionOption) => {
      setQuery('')
      setOpen(false)
      onChange(rx.id, rx.current_version_id)
    },
    [onChange],
  )

  const selected = value ? prescriptions.find((p) => p.id === value) : null

  const selectedLabel = selected
    ? `${selected.prescription_type} #${selected.id.slice(0, 8).toUpperCase()}${selected.patient_nome ? ` — ${selected.patient_nome}` : ''}`
    : ''

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <Label htmlFor="rx-search">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex h-9 w-full items-center rounded-lg border px-2.5 text-sm transition-colors duration-150 ease-[var(--ease-out)]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          open && 'border-ring',
          error && 'border-destructive',
        )}
      >
        <Search className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <input
          id="rx-search"
          type="text"
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={open ? placeholder : selectedLabel || placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/40"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/30" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-150 ease-[var(--ease-out)]',
              open && 'rotate-180',
            )}
          />
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center py-6 text-xs text-muted-foreground/40">
              {loading ? 'Carregando...' : 'Nenhuma receita encontrada'}
            </li>
          ) : (
            filtered.map((rx) => (
              <li
                key={rx.id}
                role="option"
                aria-selected={rx.id === value}
                onClick={() => handleSelect(rx)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(rx) }}
                tabIndex={0}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ease-[var(--ease-out)]',
                  'hover:bg-accent hover:text-accent-foreground',
                  rx.id === value && 'bg-accent/60 font-medium',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground font-medium">{rx.prescription_type} #{rx.id.slice(0, 8).toUpperCase()}</p>
                  <p className="truncate text-[11px] text-muted-foreground/50">
                    {rx.patient_nome ? `Paciente: ${rx.patient_nome}` : 'Sem paciente'} — {rx.prescriber_name}
                  </p>
                </div>
                {rx.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
