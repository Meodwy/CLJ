'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Check, ChevronDown, Search } from 'lucide-react'

interface Patient {
  id: string
  nome: string
  cpf: string | null
}

interface PatientSelectProps {
  value: string       // patient UUID
  onChange: (id: string, nome: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string | null
}

export function PatientSelect({
  value,
  onChange,
  label = 'Paciente',
  placeholder = 'Buscar paciente pelo nome...',
  required = false,
  error,
}: PatientSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch patients on mount
  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    supabase
      .from('pacientes')
      .select('id, nome, cpf')
      .order('nome', { ascending: true })
      .then(({ data, error: err }) => {
        if (!err && data) setPatients(data as Patient[])
        setLoading(false)
      })
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // If value changes externally (e.g. cleared), reset name
  useEffect(() => {
    if (!value) setSelectedName('')
  }, [value])

  const filtered = query
    ? patients.filter(
        (p) =>
          p.nome.toLowerCase().includes(query.toLowerCase()) ||
          (p.cpf && p.cpf.includes(query)),
      )
    : patients

  const handleSelect = useCallback(
    (patient: Patient) => {
      setSelectedName(patient.nome)
      setQuery('')
      setOpen(false)
      onChange(patient.id, patient.nome)
    },
    [onChange],
  )

  const selectedPatient = value && patients.find((p) => p.id === value)

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <Label htmlFor="patient-search">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>

      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex h-9 w-full items-center rounded-lg border px-2.5 text-sm transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          open && 'border-ring',
          error && 'border-destructive',
        )}
      >
        <Search className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <input
          id="patient-search"
          type="text"
          value={open ? query : selectedPatient ? selectedPatient.nome : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            if (!query && value) {
              // Clear selection on re-focus so user can search
              onChange('', '')
              setSelectedName('')
            }
          }}
          placeholder={open ? placeholder : selectedPatient ? selectedPatient.nome : placeholder}
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

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg',
            'transition-[transform,opacity] duration-150 ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          )}
        >
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center py-6 text-xs text-muted-foreground/40">
              {loading ? 'Carregando...' : 'Nenhum paciente encontrado'}
            </li>
          ) : (
            filtered.map((patient) => (
              <li
                key={patient.id}
                role="option"
                aria-selected={patient.id === value}
                onClick={() => handleSelect(patient)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelect(patient)
                }}
                tabIndex={0}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-[background-color,transform] duration-150 ease-[var(--ease-out)]',
                  'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
                  patient.id === value && 'bg-accent/60 font-medium',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground">{patient.nome}</p>
                  {patient.cpf && (
                    <p className="truncate text-[11px] text-muted-foreground/50">
                      {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </p>
                  )}
                </div>
                {patient.id === value && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
