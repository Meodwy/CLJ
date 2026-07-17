'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useBreadcrumbLabel } from '@/contexts/breadcrumb-context'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { tipoDespesaLabels, type TipoDespesa, type FormaPagamento } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const tiposDespesa: TipoDespesa[] = [
  'aluguel', 'salario', 'agua', 'energia', 'telefone', 'internet',
  'material_escritorio', 'manutencao', 'marketing', 'impostos',
  'compra_produtos', 'operacional', 'outros',
]

const formasPagamento: FormaPagamento[] = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'boleto', 'transferencia', 'outros']

export default function NovaDespesaPage() {
  const { setDynamicLabel } = useBreadcrumbLabel()

  useEffect(() => {
    setDynamicLabel('Nova Despesa')
    return () => setDynamicLabel(null)
  }, [setDynamicLabel])

  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo: 'operacional' as TipoDespesa,
    descricao: '',
    valor: 0,
    data_despesa: new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix' as FormaPagamento,
    observacao: '',
    recorrente: false,
    dia_vencimento: 5,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao) { toast.error('Descrição é obrigatória'); return }
    if (form.valor <= 0) { toast.error('Valor deve ser maior que zero'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('despesas').insert({
      tipo: form.tipo,
      descricao: form.descricao,
      valor: form.valor,
      data_despesa: form.data_despesa,
      forma_pagamento: form.forma_pagamento,
      usuario_id: user?.id,
      observacao: form.observacao || null,
      recorrente: form.recorrente,
      dia_vencimento: form.recorrente ? form.dia_vencimento : null,
    })

    if (error) {
      toast.error('Erro ao registrar despesa: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('Despesa registrada!')
    router.push('/dashboard/financeiro/despesas')
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/financeiro/despesas')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-foreground">Nova Despesa</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">Registrar saída de caixa</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-[15px] font-semibold text-foreground">Detalhes da Despesa</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Tipo</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px]"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value as TipoDespesa })}
              >
                {tiposDespesa.map(t => (
                  <option key={t} value={t}>{tipoDespesaLabels[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Data</Label>
              <Input type="date" value={form.data_despesa} onChange={e => setForm({ ...form, data_despesa: e.target.value })} required className="h-9 rounded-lg text-[13px]" />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Descrição</Label>
            <Input
              placeholder="Ex: Aluguel do mês de julho"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              required
              className="h-9 rounded-lg text-[13px]"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Valor (R$)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                placeholder="0,00"
                value={form.valor || ''}
                onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                required
                className="h-9 rounded-lg text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Pagamento</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px]"
                value={form.forma_pagamento}
                onChange={e => setForm({ ...form, forma_pagamento: e.target.value as FormaPagamento })}
              >
                {formasPagamento.map(fp => (
                  <option key={fp} value={fp}>
                    {fp === 'cartao_credito' ? 'Cartão de Crédito' : fp === 'cartao_debito' ? 'Cartão de Débito' : fp.charAt(0).toUpperCase() + fp.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Observação</Label>
            <Input
              placeholder="Observação (opcional)"
              value={form.observacao}
              onChange={e => setForm({ ...form, observacao: e.target.value })}
              className="h-9 rounded-lg text-[13px]"
            />
          </div>

          {/* ── Recorrência ── */}
          <div className="mt-5 pt-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, recorrente: !form.recorrente })}
                className={cn(
                  'relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  form.recorrente ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                  form.recorrente ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
              <div>
                <Label className="text-[13px] font-medium text-foreground cursor-pointer" onClick={() => setForm({ ...form, recorrente: !form.recorrente })}>
                  Despesa Mensal
                </Label>
                <p className="text-[12px] text-muted-foreground/60">Repete todo mês automaticamente</p>
              </div>
            </div>

            {form.recorrente && (
              <div className="mt-3 flex items-center gap-3">
                <Label className="text-[13px] text-muted-foreground w-32">Vencimento todo dia</Label>
                <select
                  value={form.dia_vencimento}
                  onChange={e => setForm({ ...form, dia_vencimento: parseInt(e.target.value) })}
                  className="flex h-9 w-20 rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px]"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value={29}>29</option>
                  <option value={30}>30</option>
                  <option value={31}>31 (úteis)</option>
                </select>
                <span className="text-[12px] text-muted-foreground/60">de cada mês</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/financeiro/despesas')}
            className="h-10 rounded-xl border border-border bg-card px-5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted"
          >
            Cancelar
          </button>
          <Button
            type="submit"
            disabled={saving}
            className="h-10 rounded-xl bg-primary px-5 text-[13px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {saving ? 'Salvando...' : 'Registrar Despesa'}
          </Button>
        </div>
      </form>
    </div>
  )
}
