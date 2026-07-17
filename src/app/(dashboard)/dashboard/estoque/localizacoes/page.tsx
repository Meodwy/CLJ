'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Localizacao } from '@/lib/supabase/types'

export default function LocalizacoesPage() {
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([])
  const [loading, setLoading] = useState(true)
  const [mount, setMount] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    setor: '',
    armario: '',
    prateleira: '',
    gaveta: '',
    descricao: '',
  })

  useEffect(() => { const t = setTimeout(() => setMount(true), 30); return () => clearTimeout(t) }, [])

  const load = async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('localizacoes')
        .select('*')
        .eq('ativo', true)
        .order('setor')
        .order('armario')
        .order('prateleira')
      if (data) setLocalizacoes(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.setor.trim()) {
      toast.error('Setor é obrigatório')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('localizacoes').insert({
        setor: formData.setor.trim(),
        armario: formData.armario.trim() || null,
        prateleira: formData.prateleira.trim() || null,
        gaveta: formData.gaveta.trim() || null,
        descricao: formData.descricao.trim() || null,
        ativo: true,
      })

      if (error) {
        toast.error('Erro ao cadastrar localização')
        console.error(error)
        setSaving(false)
        return
      }

      toast.success('Localização cadastrada!')
      setFormData({ setor: '', armario: '', prateleira: '', gaveta: '', descricao: '' })
      setShowForm(false)
      await load()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao cadastrar localização')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${label}"?`)) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('localizacoes')
        .update({ ativo: false })
        .eq('id', id)

      if (error) {
        toast.error('Erro ao excluir localização')
        console.error(error)
        return
      }

      toast.success('Localização excluída')
      await load()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao excluir localização')
    }
  }

  function formatLocation(l: Localizacao) {
    const parts = [l.setor]
    if (l.armario) parts.push(`Arm. ${l.armario}`)
    if (l.prateleira) parts.push(`Prat. ${l.prateleira}`)
    if (l.gaveta) parts.push(`Gav. ${l.gaveta}`)
    return parts.join(' > ')
  }

  const inputClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)]"

  return (
    <div className={`mx-auto max-w-4xl space-y-6 transition-all duration-500 ease-[var(--ease-out)] ${mount ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Localizações</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {loading ? 'Carregando…' : `${localizacoes.length} localização${localizacoes.length !== 1 ? 'ões' : ''} cadastrada${localizacoes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}
          className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97]">
          {showForm ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {showForm ? 'Fechar' : 'Nova Localização'}
        </Button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-[15px] font-semibold text-foreground">Nova Localização</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="setor" className="text-[13px] font-medium text-foreground/80">
                  Setor <span className="text-destructive">*</span>
                </Label>
                <Input id="setor" value={formData.setor}
                  onChange={e => setFormData(f => ({ ...f, setor: e.target.value }))}
                  placeholder="Ex: F armazenamento" disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="armario" className="text-[13px] font-medium text-foreground/80">Armário</Label>
                <Input id="armario" value={formData.armario}
                  onChange={e => setFormData(f => ({ ...f, armario: e.target.value }))}
                  placeholder="Ex: A01" disabled={saving} className={inputClass} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prateleira" className="text-[13px] font-medium text-foreground/80">Prateleira</Label>
                <Input id="prateleira" value={formData.prateleira}
                  onChange={e => setFormData(f => ({ ...f, prateleira: e.target.value }))}
                  placeholder="Ex: P02" disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gaveta" className="text-[13px] font-medium text-foreground/80">Gaveta</Label>
                <Input id="gaveta" value={formData.gaveta}
                  onChange={e => setFormData(f => ({ ...f, gaveta: e.target.value }))}
                  placeholder="Ex: G01" disabled={saving} className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-[13px] font-medium text-foreground/80">Descrição</Label>
              <Input id="descricao" value={formData.descricao}
                onChange={e => setFormData(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição da localização" disabled={saving} className={inputClass} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={saving || !formData.setor.trim()}
                className="h-[46px] rounded-xl bg-primary px-6 text-[15px] font-medium shadow-sm">
                {saving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : 'Salvar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormData({ setor: '', armario: '', prateleira: '', gaveta: '', descricao: '' }) }}
                disabled={saving} className="h-[46px] rounded-xl text-[15px]">
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-28"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
      ) : localizacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
            <MapPin className="h-7 w-7 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">Nenhuma localização ainda</h3>
          <p className="mt-1 max-w-xs text-center text-[14px] text-muted-foreground">
            Adicione localizações para endereçar seus produtos no estoque
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-6 h-10 rounded-xl bg-primary px-5 text-[13px] font-medium">
            <Plus className="mr-1.5 h-4 w-4" />Adicionar
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Localização</th>
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Setor</th>
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Armário</th>
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Prateleira</th>
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Gaveta</th>
                <th className="px-4 py-3 font-medium text-muted-foreground/70">Descrição</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {localizacoes.map(l => (
                <tr key={l.id} className="border-b border-border/50 last:border-0 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{formatLocation(l)}</td>
                  <td className="px-4 py-3 text-foreground">{l.setor}</td>
                  <td className="px-4 py-3 text-muted-foreground/70">{l.armario || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground/70">{l.prateleira || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground/70">{l.gaveta || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground/70 max-w-[200px] truncate">{l.descricao || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(l.id, formatLocation(l))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}