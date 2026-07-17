'use client'

import { cn } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS, type PrescriptionStatus } from '@/lib/receitas/types'

interface PrescriptionStatusBadgeProps {
  status: PrescriptionStatus
  className?: string
}

/** Maps STATUS_COLORS text-color utility to a matching background tint. */
const colorToBg: Record<string, string> = {
  'text-muted-foreground': 'bg-muted-foreground/10',
  'text-amber-500': 'bg-amber-500/10',
  'text-blue-500': 'bg-blue-500/10',
  'text-orange-500': 'bg-orange-500/10',
  'text-destructive': 'bg-destructive/10',
  'text-emerald-500': 'bg-emerald-500/10',
  'text-emerald-600': 'bg-emerald-600/10',
  'text-violet-500': 'bg-violet-500/10',
  'text-destructive/60': 'bg-destructive/10',
  'text-muted-foreground/50': 'bg-muted-foreground/10',
  'text-red-600': 'bg-red-600/10',
  'text-muted-foreground/40': 'bg-muted-foreground/10',
}

export function PrescriptionStatusBadge({ status, className }: PrescriptionStatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || 'text-muted-foreground'
  const bgClass = colorToBg[colorClass] || 'bg-muted-foreground/10'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        colorClass,
        bgClass,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}
