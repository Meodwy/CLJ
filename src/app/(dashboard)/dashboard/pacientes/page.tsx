'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, Users, X, Phone, Mail, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Paciente { id: string; nome: string; cpf: string; telefone: string; email: string | null; created_at: string }

function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function formatCPF(cpf: string) { return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') }
function formatPhone(p: string) { return p.length === 11 ? `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}` : p.length === 10 ? `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}` : p }
function formatDate(d: string) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) }

const avatarColors = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
]
function hashColor(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return avatarColors[Math.abs(h) % avatarColors.length] }

export default function PacientesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  async function loadPacientes(q?: string) {
    setLoading(true)
    let query = supabase.from('pacientes').select('*')

    if (q && q.trim()) {
      const term = q.trim()
      query = query.or(`nome.ilike.%${term}%,cpf.ilike.%${term.replace(/\D/g, '')}%`)
    }

    query = query.order('nome')

    const { data } = await query
    if (data) setPacientes(data)
    setLoading(false)
  }

  useEffect(() => { loadPacientes() }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPacientes(value), 300)
  }, [])

  const clearSearch = useCallback(() => {
    setSearch('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    inputRef.current?.focus()
    loadPacientes()
  }, [])

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Pacientes</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {loading ? 'Buscando...' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={() => router.push('/dashboard/pacientes/cadastro')}
            className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />Novo Paciente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative mx-auto max-w-2xl">
          <div className="flex items-center rounded-xl border border-border bg-card shadow-sm focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.06)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-l-xl bg-muted/50">
              <Search className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <input
              ref={inputRef}
              placeholder="Buscar paciente por nome ou CPF..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="h-12 flex-1 bg-transparent px-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      ) : pacientes.length === 0 ? (
        search ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">Nenhum resultado para &ldquo;{search}&rdquo;</h3>
            <p className="text-[14px] text-muted-foreground">Tente ajustar sua busca</p>
            <Button variant="outline" onClick={clearSearch} className="mt-5 h-9 rounded-xl text-[13px]">
              Limpar busca
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <Users className="h-7 w-7 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="mt-5 font-heading text-lg font-semibold text-foreground">Nenhum paciente ainda</h3>
            <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">
              Cadastre o primeiro paciente para comecar
            </p>
            <Button
              onClick={() => router.push('/dashboard/pacientes/cadastro')}
              className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium"
            >
              <Plus className="mr-1.5 h-4 w-4" />Cadastrar
            </Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pacientes.map((p, i) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard/pacientes/${p.id}/editar`)}
              className="group relative rounded-xl border border-border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.98]"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
            >
              <div className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${hashColor(p.id)} text-[15px] font-semibold shadow-sm`}>
                    {getInitials(p.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-foreground truncate">{p.nome}</p>
                    <p className="text-[12px] text-muted-foreground/60">{formatCPF(p.cpf)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 transition-colors duration-200 group-hover:text-primary/60" />
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground/40" />
                    {formatPhone(p.telefone)}
                  </span>
                  {p.email && (
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70 truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/40" />
                      {p.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                    {formatDate(p.created_at)}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
                  <Clock className="h-3 w-3 text-muted-foreground/30" />
                  <span className="text-[11px] text-muted-foreground/40">
                    Cadastrado em {formatDate(p.created_at)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
