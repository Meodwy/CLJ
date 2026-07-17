'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Plus, Pencil, Trash2, X, UserCog, Shield,
  AlertTriangle, Search,
} from 'lucide-react'

const roleLabels: Record<string, string> = {
  administrador: 'Administrador',
  farmaceutico: 'Farmacêutico',
  atendente: 'Atendente',
  manipulador: 'Manipulador',
  estoquista: 'Estoquista',
  financeiro: 'Financeiro',
}

interface UserRow {
  id: string
  nome: string
  email: string
  role: string
  created_at: string
}

export default function ConfiguracoesUsuariosPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'atendente' })

  const fetchUsers = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/configuracoes/usuarios', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) throw new Error('Falha ao carregar')
    setUsers(await res.json())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { await fetchUsers() } catch { toast.error('Erro ao carregar usuários') }
    setLoading(false)
  }, [fetchUsers])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/configuracoes/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'Erro ao criar')
      return
    }
    toast.success('Usuário criado!')
    setShowModal(false)
    setForm({ nome: '', email: '', password: '', role: 'atendente' })
    await fetchUsers()
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/configuracoes/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ role: newRole }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'Erro ao atualizar')
      return
    }
    toast.success('Função atualizada!')
    setEditingId(null)
    await fetchUsers()
  }

  async function handleDelete(userId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/configuracoes/usuarios/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'Erro ao excluir')
      return
    }
    toast.success('Usuário excluído!')
    setDeletingId(null)
    await fetchUsers()
  }

  const filtered = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">Usuários</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Gerencie os usuários e permissões do sistema</p>
        </div>
        {profile?.role === 'administrador' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/80 bg-card pl-10 pr-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <UserCog className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/60">
              {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground/50">Nome</th>
                  <th className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground/50">Email</th>
                  <th className="px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground/50">Função</th>
                  <th className="hidden px-5 py-3.5 text-left text-[12px] font-medium uppercase tracking-wider text-muted-foreground/50 sm:table-cell">Criado em</th>
                  <th className="px-5 py-3.5 text-right text-[12px] font-medium uppercase tracking-wider text-muted-foreground/50">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 text-[11px] font-semibold text-primary shadow-sm">
                          {user.nome.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.nome}</p>
                          {user.id === profile?.id && (
                            <span className="text-[11px] text-primary/60">Você</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                    <td className="px-5 py-3.5">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            defaultValue={user.role}
                            onChange={(e) => {
                              handleRoleChange(user.id, e.target.value)
                            }}
                            autoFocus
                            className="h-8 rounded-lg border border-border/60 bg-background px-2 text-[13px] outline-none focus-visible:border-primary/40"
                          >
                            {Object.entries(roleLabels).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg p-1 text-muted-foreground/40 hover:text-muted-foreground/70"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                            user.role === 'administrador'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-primary/8 text-primary/70'
                          }`}>
                            <Shield className="h-3 w-3" />
                            {roleLabels[user.role] || user.role}
                          </span>
                          {profile?.role === 'administrador' && user.id !== profile.id && (
                            <button
                              onClick={() => setEditingId(user.id)}
                              className="rounded-lg p-1 text-muted-foreground/30 transition-colors hover:text-muted-foreground/60"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 text-muted-foreground/60 sm:table-cell">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {profile?.role === 'administrador' && user.id !== profile.id && (
                        <button
                          onClick={() => setDeletingId(user.id)}
                          className="rounded-lg p-1.5 text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-foreground">Novo Usuário</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-muted-foreground/40 hover:text-muted-foreground/70">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/80">Nome</label>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome completo"
                  className="h-[44px] w-full rounded-xl border border-border/80 bg-background px-4 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/80">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="h-[44px] w-full rounded-xl border border-border/80 bg-background px-4 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/80">Senha</label>
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="h-[44px] w-full rounded-xl border border-border/80 bg-background px-4 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/80">Função</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="h-[44px] w-full rounded-xl border border-border/80 bg-background px-4 text-[14px] outline-none transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
                >
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground/70 transition-all hover:bg-accent active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="mt-4 font-heading text-base font-semibold text-foreground">Excluir Usuário</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tem certeza? Esta ação não pode ser desfeita. O usuário será removido do sistema permanentemente.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground/70 transition-all hover:bg-accent active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
