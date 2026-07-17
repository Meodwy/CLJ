'use client'

import { useRouter } from 'next/navigation'
import { FileText, User, Calendar, Stethoscope, Upload, ShieldCheck, FileBox } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PrescriptionStatusBadge } from './prescription-status-badge'
import { DOCUMENT_ORIGIN_LABELS, type Prescription } from '@/lib/receitas/types'

export interface PrescriptionCardData extends Prescription {
  patient_name?: string
  patient?: { id: string; nome: string } | null
  uploader_name?: string
  has_signature?: boolean
}

interface PrescriptionCardProps {
  prescription: PrescriptionCardData
}

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  const router = useRouter()
  const p = prescription

  const codigo = p.id.slice(0, 8).toUpperCase()
  const issuedAt = p.issued_at
    ? new Date(p.issued_at).toLocaleDateString('pt-BR')
    : '—'
  const createdAt = new Date(p.created_at).toLocaleDateString('pt-BR')
  const originLabel = DOCUMENT_ORIGIN_LABELS[p.document_origin] || p.document_origin

  return (
    <Card
      size="sm"
      className="cursor-pointer transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out)] hover:shadow-sm hover:border-foreground/20 active:scale-[0.98]"
      onClick={() => router.push(`/dashboard/receitas/${p.id}`)}
    >
      <CardContent className="space-y-3 pt-3">
        {/* Top row: code + status */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-medium text-muted-foreground">
            #{codigo}
          </span>
          <PrescriptionStatusBadge status={p.status} />
        </div>

        {/* Patient + prescriber */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            <span className="font-medium text-foreground">
              {p.patient?.nome || p.patient_name || p.patient_id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            <span>{p.prescriber_name}</span>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Emissao: {issuedAt}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{originLabel}</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground/60">
          <span>Criado em {createdAt}</span>
          <div className="flex items-center gap-3">
            {p.uploader_name && (
              <span className="flex items-center gap-1">
                <Upload className="h-3 w-3" />
                {p.uploader_name}
              </span>
            )}
            {p.has_signature && (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            )}
            {p.physical_original_required && (
              <FileBox className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
