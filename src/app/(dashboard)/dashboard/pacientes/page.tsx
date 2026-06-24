'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Loader2,
  Users,
  X,
  Phone,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Paciente {
  id: string
  nome: string
  cpf: string
  telefone: string
  email: string | null
  created_at: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatCPF(cpf: string) {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function formatPhone(phone: string) {
  if (phone.length === 11)
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10)
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone
}

const avatarColours = [
  'bg-blue-100 text-blue-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
]

function hashColour(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColours[Math.abs(hash) % avatarColours.length]
}

export default function PacientesPage() {
  const router = useRouter()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .order('nome', { ascending: true })
      if (data) setPacientes(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  }, [pacientes, searchInput])

  const totalCount = pacientes.length
  const hasSearch = searchInput.trim().length > 0

  const clearSearch = useCallback(() => {
    setSearchInput('')
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className={`mx-auto max-w-6xl transition-all duration-500 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#111827]">
            Pacientes
          </h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            {loading
              ? 'Carregando…'
              : `${totalCount} paciente${totalCount !== 1 ? 's' : ''} cadastrado${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/pacientes/cadastro')}
          className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Paciente
        </Button>
      </div>

      {/* Search */}
      <div className="mt-6">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
          <input
            ref={inputRef}
            placeholder="Buscar por nome ou CPF…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#ECEEF2] bg-white pl-10 pr-10 text-[14px] text-[#111827] outline-none transition-all duration-150 placeholder:text-[#9CA3AF] focus:border-primary/30 focus:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.06)]"
          />
          {hasSearch && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!loading && hasSearch && (
          <p className="mt-1.5 text-[13px] text-[#9CA3AF]">
            {filtered.length === 0
              ? 'Nenhum paciente encontrado'
              : `${filtered.length} de ${totalCount} paciente${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
        </div>
      ) : pacientes.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#ECEEF2] bg-white/60 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Users className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-[#111827]">Nenhum paciente ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] leading-relaxed text-[#6B7280]">
            Cadastre o primeiro paciente para começar
          </p>
          <Button
            onClick={() => router.push('/dashboard/pacientes/cadastro')}
            className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Cadastrar
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#ECEEF2] bg-white/60 px-6 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Search className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#111827]">Nenhum resultado</h3>
          <p className="mt-0.5 text-[14px] text-[#6B7280]">Tente ajustar sua busca</p>
          <Button variant="outline" onClick={clearSearch} className="mt-5 h-9 rounded-xl text-[13px]">
            Limpar busca
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          {/* Header row */}
          <div className="mb-1 hidden grid-cols-[1fr_160px_160px_1fr_28px] gap-4 px-5 lg:grid">
            <span className="py-2 text-[11px] font-medium uppercase tracking-widest text-[#9CA3AF]">Nome</span>
            <span className="py-2 text-[11px] font-medium uppercase tracking-widest text-[#9CA3AF]">CPF</span>
            <span className="py-2 text-[11px] font-medium uppercase tracking-widest text-[#9CA3AF]">Telefone</span>
            <span className="py-2 text-[11px] font-medium uppercase tracking-widest text-[#9CA3AF]">Email</span>
            <span />
          </div>

          <div className="space-y-1">
            {filtered.map((paciente, index) => (
              <button
                key={paciente.id}
                onClick={() => router.push(`/dashboard/pacientes/${paciente.id}/editar`)}
                className={`group grid w-full grid-cols-1 items-center gap-3 rounded-2xl border border-[#ECEEF2] bg-white px-5 py-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] active:scale-[0.99] lg:grid-cols-[1fr_160px_160px_1fr_28px] ${
                  mounted ? 'animate-in fade-in slide-in-from-bottom-2' : 'opacity-0'
                }`}
                style={{
                  animationDelay: `${Math.min(index * 25, 350)}ms`,
                  animationDuration: '300ms',
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${hashColour(paciente.id)}`}
                  >
                    {getInitials(paciente.nome)}
                  </div>
                  <span className="text-[14px] font-medium text-[#111827] transition-colors group-hover:text-primary">
                    {paciente.nome}
                  </span>
                  <div className="ml-auto flex items-center gap-3 text-[13px] text-[#9CA3AF] lg:hidden">
                    <span>{formatPhone(paciente.telefone)}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
                <span className="hidden text-[14px] text-[#6B7280] lg:block">{formatCPF(paciente.cpf)}</span>
                <span className="hidden items-center gap-1.5 text-[14px] text-[#6B7280] lg:flex">
                  <Phone className="h-3.5 w-3.5 text-[#9CA3AF]" />
                  {formatPhone(paciente.telefone)}
                </span>
                <span className="hidden truncate text-[14px] text-[#6B7280] lg:block">
                  {paciente.email ?? <span className="text-[#9CA3AF]">&mdash;</span>}
                </span>
                <div className="hidden lg:flex lg:justify-center">
                  <ChevronRight className="h-4 w-4 text-[#9CA3AF]/20 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary/50" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}