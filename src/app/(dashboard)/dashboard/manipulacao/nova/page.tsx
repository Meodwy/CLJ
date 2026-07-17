'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, Plus, Loader2, Trash2 } from 'lucide-react'
import type { PriorityLevel } from '@/lib/compounding/types'
import { PatientSelect } from '@/components/ui/patient-select'
import { PrescriptionSelect } from '@/components/ui/prescription-select'
import { InventoryItemSelect } from '@/components/ui/inventory-item-select'

interface FormulaItem {
  id: string
  type: 'ACTIVE_INGREDIENT' | 'EXCIPIENT' | 'VEHICLE' | 'BASE'
  inventory_item_id: string
  name: string
  quantity: string
  unit: string
}

export default function NovaOrdemPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [patientId, setPatientId] = useState('')
  const [pharmaceuticalForm, setPharmaceuticalForm] = useState('Cápsula')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('un')
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL')
  const [dueAt, setDueAt] = useState('')
  const [prescriptionId, setPrescriptionId] = useState('')
  const [prescriptionVersionId, setPrescriptionVersionId] = useState('')

  const [formulaItems, setFormulaItems] = useState<FormulaItem[]>([
    { id: crypto.randomUUID(), type: 'ACTIVE_INGREDIENT', inventory_item_id: '', name: '', quantity: '', unit: 'mg' },
  ])

  const addItem = () => {
    setFormulaItems(prev => [...prev, { id: crypto.randomUUID(), type: 'EXCIPIENT', inventory_item_id: '', name: '', quantity: '', unit: 'mg' }])
  }

  const removeItem = (id: string) => {
    if (formulaItems.length <= 1) return
    setFormulaItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof FormulaItem, value: string) => {
    setFormulaItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { createOrder } = await import('@/lib/compounding/service')

      const formulaData = {
        instructions: 'Fórmula personalizada',
        items: formulaItems.map(i => ({ name: i.name, type: i.type })),
      }

      const calculationData = {
        totalQuantity: Number(quantity),
        unit,
        batchSize: Number(quantity),
        overage: 0,
      }

      const itemsJson = formulaItems
        .filter(i => i.name && Number(i.quantity) > 0)
        .map(i => ({
          inventory_item_id: i.inventory_item_id,
          item_type: i.type,
          theoretical_quantity: Number(i.quantity),
          technical_margin_quantity: 0,
          total_required_quantity: Number(i.quantity),
          unit: i.unit,
          sequence: formulaItems.indexOf(i) + 1,
        }))

      await createOrder({
        clinic_id: '00000000-0000-0000-0000-000000000001',
        patient_id: patientId || '00000000-0000-0000-0000-000000000001',
        prescription_id: prescriptionId || '00000000-0000-0000-0000-000000000001',
        prescription_version_id: prescriptionVersionId || '00000000-0000-0000-0000-000000000000',
        pharmaceutical_form: pharmaceuticalForm,
        requested_quantity: Number(quantity),
        requested_unit: unit,
        priority,
        due_at: dueAt || undefined,
        formula_data: formulaData,
        calculation_data: calculationData,
        items_json: itemsJson,
      })

      router.push('/dashboard/manipulacao')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar ordem')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/manipulacao')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">Nova Ordem de Manipulacao</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Criar ordem a partir de prescricao</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Patient & Rx Info */}
        <Card size="sm">
          <CardHeader>
            <CardTitle>Dados da Prescricao</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <PatientSelect
                value={patientId}
                onChange={(id) => setPatientId(id)}
              />
            </div>
            <div className="sm:col-span-2">
              <PrescriptionSelect
                patientId={patientId}
                value={prescriptionId}
                onChange={(id, versionId) => {
                  setPrescriptionId(id)
                  setPrescriptionVersionId(versionId ?? '')
                }}
              />
            </div>
            <div>
              <Label htmlFor="form" className="mb-1.5 block text-sm font-medium">Forma Farmaceutica</Label>
              <select
                id="form"
                value={pharmaceuticalForm}
                onChange={e => setPharmaceuticalForm(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option>Cápsula</option>
                <option>Comprimido</option>
                <option>Solução</option>
                <option>Suspensão</option>
                <option>Pomada</option>
                <option>Creme</option>
                <option>Gel</option>
                <option>Xarope</option>
                <option>Colírio</option>
                <option>Outro</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="qty" className="mb-1.5 block text-sm font-medium">Quantidade</Label>
                <Input id="qty" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="30" />
              </div>
              <div className="w-20">
                <Label htmlFor="unit" className="mb-1.5 block text-sm font-medium">Unid.</Label>
                <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="un" />
              </div>
            </div>
            <div>
              <Label htmlFor="priority" className="mb-1.5 block text-sm font-medium">Prioridade</Label>
              <select
                id="priority"
                value={priority}
                onChange={e => setPriority(e.target.value as PriorityLevel)}
                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
            <div>
              <Label htmlFor="due" className="mb-1.5 block text-sm font-medium">Data Prevista</Label>
              <Input id="due" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Formula Items */}
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Formula</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" />
                Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {formulaItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={item.type}
                      onChange={e => updateItem(item.id, 'type', e.target.value)}
                      className="flex h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      <option value="ACTIVE_INGREDIENT">Insumo Ativo</option>
                      <option value="EXCIPIENT">Excipiente</option>
                      <option value="VEHICLE">Veículo</option>
                      <option value="BASE">Base</option>
                    </select>
                    <InventoryItemSelect
                      value={item.inventory_item_id}
                      onSelect={(id, nome) => {
                        updateItem(item.id, 'inventory_item_id', id)
                        updateItem(item.id, 'name', nome)
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                      placeholder="Quantidade"
                      className="h-8 w-28 text-sm"
                    />
                    <Input
                      value={item.unit}
                      onChange={e => updateItem(item.id, 'unit', e.target.value)}
                      placeholder="un"
                      className="h-8 w-16 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="mt-1 rounded-md p-1 text-muted-foreground/40 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || !quantity}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Criando...' : 'Criar Ordem de Manipulacao'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/manipulacao')}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
