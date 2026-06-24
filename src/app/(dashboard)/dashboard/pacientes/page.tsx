'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Loader2, Users, X, Phone, Mail, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Paciente { id: string; nome: string; cpf: string; telefone: string; email: string | null; created_at: string }

function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function formatCPF(cpf: string) { return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') }
function formatPhone(p: string) { return p.length === 11 ? `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}` : p.length === 10 ? `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}` : p }

const avatarColors = ['bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300', 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300', 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300', 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300']
function hashColor(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return avatarColors[Math.abs(h) % avatarColors.length] }

export default function PacientesPage() {
  const router = useRouter()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [mount, setMount] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])
  useEffect(() => { const load = async () => { const { data } = await createClient().from('pacientes').select('*').order('nome'); if (data) setPacientes(data); setLoading(false) }; load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter(p => p.nome.toLowerCase().includes(q) || p.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
  }, [pacientes, search])

  const clearSearch = useCallback(() => { setSearch(''); inputRef.current?.focus() }, [])

  return (
    <div className={`mx-auto max-w-6xl space-y-6 transition-all duration-500 ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Pacientes</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''} cadastrado${pacientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/pacientes/cadastro')}
          className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.97]">
          <Plus className="mr-1.5 h-4 w-4" />Novo Paciente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
        <input ref={inputRef} placeholder="Buscar por nome ou CPF…" value={search} onChange={e => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-[14px] text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/30 focus:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.06)]" />
        {search && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"><X className="h-4 w-4" /></button>}
        {!loading && search && <p className="mt-1.5 text-[13px] text-muted-foreground/60">{filtered.length} de {pacientes.length}</p>}
      </div>

      {/* Grid de Pacientes — Cards Unificados */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : pacientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20"><Users className="h-7 w-7 text-blue-500 dark:text-blue-400" /></div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhum paciente ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">Cadastre o primeiro paciente para começar</p>
          <Button onClick={() => router.push('/dashboard/pacientes/cadastro')} className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium">
            <Plus className="mr-1.5 h-4 w-4" />Cadastrar
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><Search className="h-6 w-6 text-muted-foreground/30" /></div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Nenhum resultado</h3>
          <p className="text-[14px] text-muted-foreground">Tente ajustar sua busca</p>
          <Button variant="outline" onClick={clearSearch} className="mt-5 h-9 rounded-xl text-[13px]">Limpar busca</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <button key={p.id} onClick={() => router.push(`/dashboard/pacientes/${p.id}/editar`)}
              className={`group relative rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md active:scale-[0.98] animate-fade-up ${!mount ? 'opacity-0' : ''}`}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
              {/* Avatar + Nome row */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${hashColor(p.id)} text-[14px] font-semibold`}>{getInitials(p.nome)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-foreground truncate">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground/60">{formatCPF(p.cpf)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/20 transition-colors group-hover:text-primary/60" />
              </div>
              {/* Contact details inline */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground/70">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{formatPhone(p.telefone)}</span>
                {p.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{p.email}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}