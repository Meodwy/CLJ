'use client'

import {
  Clock,
  FileText,
  Upload,
  Eye,
  Download,
  Printer,
  FileStack,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pen,
  FileCheck,
  FileArchive,
  FileX,
  Lock,
  Unlock,
  Trash2,
  ShieldOff,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PrescriptionAuditLog } from '@/lib/receitas/types'

const EVENT_ICONS: Record<string, LucideIcon> = {
  PRESCRIPTION_CREATED: FileText,
  FILE_UPLOADED: Upload,
  FILE_VIEWED: Eye,
  FILE_DOWNLOADED: Download,
  FILE_PRINTED: Printer,
  VERSION_CREATED: FileStack,
  REVIEW_STARTED: Search,
  REVIEW_APPROVED: CheckCircle,
  REVIEW_REJECTED: XCircle,
  DOCUMENTAL_ISSUE_REPORTED: AlertTriangle,
  PHARMACIST_SIGNATURE_STARTED: Pen,
  PHARMACIST_SIGNATURE_COMPLETED: FileCheck,
  PHARMACIST_SIGNATURE_FAILED: XCircle,
  SIGNATURE_VALIDATED: FileCheck,
  PRESCRIPTION_ARCHIVED: FileArchive,
  PRESCRIPTION_REPLACED: FileStack,
  PRESCRIPTION_CANCELLED: FileX,
  LEGAL_HOLD_ACTIVATED: Lock,
  LEGAL_HOLD_REMOVED: Unlock,
  DISCARD_REQUESTED: Trash2,
  DISCARD_APPROVED: Trash2,
  DOCUMENT_DISCARDED: Trash2,
  UNAUTHORIZED_ACCESS_ATTEMPT: ShieldOff,
}

const EVENT_LABELS: Record<string, string> = {
  PRESCRIPTION_CREATED: 'Receita criada',
  FILE_UPLOADED: 'Arquivo enviado',
  FILE_VIEWED: 'Documento visualizado',
  FILE_DOWNLOADED: 'Documento baixado',
  FILE_PRINTED: 'Documento impresso',
  VERSION_CREATED: 'Nova versao criada',
  REVIEW_STARTED: 'Conferencia iniciada',
  REVIEW_APPROVED: 'Conferencia aprovada',
  REVIEW_REJECTED: 'Conferencia rejeitada',
  DOCUMENTAL_ISSUE_REPORTED: 'Pendencia documental',
  PHARMACIST_SIGNATURE_STARTED: 'Assinatura iniciada',
  PHARMACIST_SIGNATURE_COMPLETED: 'Assinatura concluida',
  PHARMACIST_SIGNATURE_FAILED: 'Falha na assinatura',
  SIGNATURE_VALIDATED: 'Assinatura validada',
  PRESCRIPTION_ARCHIVED: 'Receita arquivada',
  PRESCRIPTION_REPLACED: 'Receita substituida',
  PRESCRIPTION_CANCELLED: 'Receita cancelada',
  LEGAL_HOLD_ACTIVATED: 'Retencao legal ativada',
  LEGAL_HOLD_REMOVED: 'Retencao legal removida',
  DISCARD_REQUESTED: 'Descarte solicitado',
  DISCARD_APPROVED: 'Descarte aprovado',
  DOCUMENT_DISCARDED: 'Documento descartado',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'Tentativa de acesso nao autorizado',
}

interface AuditTimelineProps {
  /** Array of audit logs to display. */
  logs: PrescriptionAuditLog[]
  className?: string
}

export function AuditTimeline({ logs, className }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-8 text-sm text-muted-foreground',
          className
        )}
      >
        Nenhum evento registrado
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {logs.map((log, index) => {
        const Icon = EVENT_ICONS[log.event_type] || Clock
        const label = EVENT_LABELS[log.event_type] || log.event_type
        const userInfo = log.user_id ? log.user_id.slice(0, 8) : 'Sistema'

        return (
          <div key={log.id} className="relative flex gap-3 pb-6 last:pb-0">
            {/* Timeline connector line */}
            {index < logs.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
            )}

            {/* Icon circle */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Event content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                {new Date(log.created_at).toLocaleString('pt-BR')}
                {log.user_id && ` — por ${userInfo}`}
              </p>
              {log.event_reason && (
                <p className="mt-1 text-xs italic text-muted-foreground">
                  &ldquo;{log.event_reason}&rdquo;
                </p>
              )}
              {log.previous_status && log.new_status && (
                <p className="mt-0.5 text-xs text-muted-foreground/50">
                  {log.previous_status} → {log.new_status}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
