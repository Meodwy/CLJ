'use client'

import { useState } from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CHECKLIST_ITEMS, type ReviewDecision } from '@/lib/receitas/types'
import { cn } from '@/lib/utils'

export interface ChecklistFormData {
  checklist: Record<string, boolean>
  notes: string
  decision: ReviewDecision
}

interface ChecklistFormProps {
  /** Callback fired when the user submits a decision. */
  onSubmit: (data: ChecklistFormData) => Promise<void>
  /** Called when the user wants to proceed to signature (after approval). */
  onProceedToSignature?: () => void
  /** Initial checklist values. */
  initialValues?: Record<string, boolean>
  /** Initial notes. */
  initialNotes?: string
  /** External submitting state. */
  submitting?: boolean
}

export function ChecklistForm({
  onSubmit,
  onProceedToSignature,
  initialValues,
  initialNotes,
  submitting,
}: ChecklistFormProps) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    CHECKLIST_ITEMS.forEach((item) => {
      initial[item.key] = initialValues?.[item.key] === true
    })
    return initial
  })
  const [notes, setNotes] = useState(initialNotes || '')
  const [localSubmitting, setLocalSubmitting] = useState(false)

  const isSubmitting = submitting ?? localSubmitting

  const checkedCount = Object.values(checklist).filter(Boolean).length
  const allChecked = checkedCount === CHECKLIST_ITEMS.length

  const toggleItem = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSubmit = async (decision: ReviewDecision) => {
    if (!submitting) setLocalSubmitting(true)
    try {
      await onSubmit({ checklist, notes, decision })
      if (decision === 'APPROVED' && onProceedToSignature) {
        onProceedToSignature()
      }
    } finally {
      if (!submitting) setLocalSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist de Conferencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ease-[var(--ease-out)]',
              checklist[item.key]
                ? 'bg-emerald-500/5 text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
          >
            <CheckboxPrimitive.Root
              checked={checklist[item.key]}
              onCheckedChange={() => toggleItem(item.key)}
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ease-[var(--ease-out)]',
                'border-input data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
            >
              <CheckboxPrimitive.Indicator>
                <Check className="h-3 w-3" />
              </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <span className="leading-snug">{item.label}</span>
          </label>
        ))}

        {/* Notes textarea */}
        <div className="pt-4">
          <Label htmlFor="checklist-notes" className="mb-1.5 block text-sm font-medium text-foreground">
            Observacoes
          </Label>
          <textarea
            id="checklist-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotacoes sobre a conferencia..."
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors duration-150 ease-[var(--ease-out)]',
              'placeholder:text-muted-foreground/40',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
            )}
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {allChecked
            ? 'Todos os itens verificados'
            : `${checkedCount}/${CHECKLIST_ITEMS.length} itens`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleSubmit('SAVED')}
          >
            Guardar Receita
          </Button>
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleSubmit('DOCUMENTAL_ISSUE')}
          >
            Apontar Pendencia
          </Button>
          <Button
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => handleSubmit('REJECTED')}
          >
            Rejeitar
          </Button>
          <Button
            disabled={!allChecked || isSubmitting}
            onClick={() => handleSubmit('APPROVED')}
          >
            {isSubmitting ? 'Salvando...' : 'Aprovar'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
