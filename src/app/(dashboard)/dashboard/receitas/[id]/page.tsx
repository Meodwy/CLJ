'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DocumentViewer } from '@/components/receitas/document-viewer'
import { PrescriptionStatusBadge } from '@/components/receitas/prescription-status-badge'
import { AuditTimeline } from '@/components/receitas/audit-timeline'
import {
  ArrowLeft,
  History,
  ScrollText,
  FileText,
  Loader2,
  Archive,
  XCircle,
  Lock,
  Unlock,
  User,
  Calendar,
  Stethoscope,
  FileBox,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  STATUS_LABELS,
  DOCUMENT_ORIGIN_LABELS,
  type Prescription,
  type PrescriptionVersion,
  type PharmacistReview,
  type PharmacistSignature,
  type PrescriptionAuditLog,
} from '@/lib/receitas/types'

interface PrescriptionDetail extends Prescription {
  patient?: { id: string; nome: string; cpf: string | null } | null
  versions?: PrescriptionVersion[]
  reviews?: PharmacistReview[]
  signatures?: PharmacistSignature[]
  audit_logs?: PrescriptionAuditLog[]
}

export default function PrescriptionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const id = params?.id as string

  const [data, setData] = useState<PrescriptionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isFarmaceutico = profile?.role === 'farmaceutico'
  const isAdmin = profile?.role === 'administrador'
  const canReview = isFarmaceutico || isAdmin

  const fetchPrescription = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      await supabase.auth.getUser() // refresh token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/receitas/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Erro ao carregar receita')
      const json = await res.json()
      setData(json.data || json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPrescription()
  }, [fetchPrescription])

  const handleAction = async (action: string, body?: Record<string, unknown>) => {
    setActionLoading(action)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      await supabase.auth.getUser() // refresh token
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/receitas/${id}/${action}`, {
        method: 'POST',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: 'Erro na operacao' }))
        throw new Error(errBody.message || errBody.error || 'Erro na operacao')
      }
      await fetchPrescription()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na operacao')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <FileText className="mb-4 h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-destructive">{error || 'Receita nao encontrada'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/receitas')}>
          Voltar para Receitas
        </Button>
      </div>
    )
  }

  const p = data
  const codigo = p.id.slice(0, 8).toUpperCase()
  const originLabel = DOCUMENT_ORIGIN_LABELS[p.document_origin] || p.document_origin
  const latestReview = p.reviews?.[p.reviews.length - 1]
  const latestSignature = p.signatures?.[p.signatures.length - 1]
  const currentVersion = p.versions?.find((v) => v.is_current)

  const canArchive = p.status === 'APROVADA'
  const canCancel = !['ARQUIVADA', 'CANCELADA', 'DESCARTADA'].includes(p.status)
  const canToggleLegalHold = true

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/receitas')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-xl font-medium text-foreground">
                Receita #{codigo}
              </h1>
              <PrescriptionStatusBadge status={p.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {originLabel} &middot; Criada em {new Date(p.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column: Document + Metadata + Versions */}
        <div className="space-y-6 lg:col-span-3">
          {/* Document Viewer */}
          {currentVersion && (
            <DocumentViewer prescriptionId={p.id} />
          )}

          {!currentVersion && (
            <div className="flex items-center justify-center rounded-xl bg-muted/30 py-16 text-sm text-muted-foreground">
              <FileText className="mr-2 h-5 w-5 text-muted-foreground/30" />
              Nenhum documento anexado
            </div>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <MetadataItem
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Paciente"
                  value={p.patient?.nome || p.patient_id.slice(0, 8)}
                />
                {p.patient?.cpf && (
                  <MetadataItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="CPF"
                    value={p.patient.cpf}
                  />
                )}
                <MetadataItem
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  label="Prescritor"
                  value={
                    p.prescriber_registration
                      ? `${p.prescriber_name} (${p.prescriber_registration}${p.prescriber_registration_state ? `-${p.prescriber_registration_state}` : ''})`
                      : p.prescriber_name
                  }
                />
                <MetadataItem icon={null} label="Tipo" value={p.prescription_type || '—'} />
                <MetadataItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Emissao"
                  value={p.issued_at ? new Date(p.issued_at).toLocaleDateString('pt-BR') : '—'}
                />
                <MetadataItem
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Validade"
                  value={p.expires_at ? new Date(p.expires_at).toLocaleDateString('pt-BR') : '—'}
                />
                <MetadataItem icon={null} label="Origem" value={originLabel} />
                <MetadataItem
                  icon={<FileBox className="h-3.5 w-3.5" />}
                  label="Original fisico"
                  value={
                    p.physical_original_required
                      ? p.physical_original_received
                        ? 'Recebido'
                        : 'Pendente'
                      : 'Nao exigido'
                  }
                />
                {p.physical_original_location && (
                  <MetadataItem icon={null} label="Localizacao" value={p.physical_original_location} />
                )}
                {p.external_platform && (
                  <MetadataItem icon={null} label="Plataforma externa" value={p.external_platform} />
                )}
                {p.external_validation_link && (
                  <MetadataItem
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    label="Link validacao"
                    value={
                      <a
                        href={p.external_validation_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        Validar
                      </a>
                    }
                  />
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Version History */}
          {p.versions && p.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Historico de Versoes
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {p.versions.map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                        v.is_current ? 'border-primary/20 bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground/40" />
                        <div>
                          <span className="font-medium text-foreground">
                            Versao {v.version_number}
                          </span>
                          {v.is_current && (
                            <span className="ml-2 text-[11px] text-primary">(atual)</span>
                          )}
                          <p className="text-[12px] text-muted-foreground/60">
                            {v.original_filename || 'Sem nome'} &middot;{' '}
                            {(v.file_size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <span className="text-[12px] text-muted-foreground/40">
                        {new Date(v.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Review + Signature + Audit + Actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pharmacist Review */}
          {latestReview && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-muted-foreground" />
                    Ultima conferencia
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Farmaceutico</span>
                  <span className="font-medium text-foreground">{latestReview.pharmacist_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Decisao</span>
                  <span className="font-medium">{STATUS_LABELS[p.status] || p.status}</span>
                </div>
                {latestReview.notes && (
                  <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
                    {latestReview.notes}
                  </p>
                )}
                <p className="text-xs text-muted-foreground/50">
                  {new Date(latestReview.reviewed_at).toLocaleString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Signature Info */}
          {latestSignature && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Assinatura do Farmaceutico
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Metodo</span>
                  <span className="font-medium text-foreground">
                    {latestSignature.signature_method === 'ADVANCED_ELECTRONIC_SIGNATURE'
                      ? 'Assinatura Avancada'
                      : 'ICP-Brasil'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground">
                    {latestSignature.signature_status === 'COMPLETED'
                      ? 'Concluida'
                      : latestSignature.signature_status === 'VALIDATED'
                        ? 'Validada'
                        : latestSignature.signature_status}
                  </span>
                </div>
                {latestSignature.certificate_subject && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Certificado</span>
                    <span className="font-medium text-foreground">
                      {latestSignature.certificate_subject}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50">
                  {new Date(latestSignature.signed_at).toLocaleString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Review button */}
          {canReview && p.status === 'AGUARDANDO_CONFERENCIA' && (
            <Button
              className="w-full"
              onClick={() => router.push(`/dashboard/receitas/${p.id}/conferencia`)}
            >
              Iniciar Conferencia
            </Button>
          )}

          {/* Audit Timeline */}
          {p.audit_logs && p.audit_logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Linha do Tempo
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline logs={p.audit_logs} />
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canArchive && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={actionLoading === 'archive'}
                  onClick={() => handleAction('archive')}
                >
                  <Archive className="h-4 w-4" />
                  {actionLoading === 'archive' ? 'Arquivando...' : 'Arquivar'}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  disabled={actionLoading === 'cancel'}
                  onClick={() => {
                    const reason = prompt('Motivo do cancelamento:')
                    if (reason) handleAction('cancel', { reason })
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar Receita'}
                </Button>
              )}
              {canToggleLegalHold && (
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start gap-2',
                    p.legal_hold ? 'text-red-600 hover:text-red-600' : ''
                  )}
                  disabled={actionLoading === 'legal-hold'}
                  onClick={() => {
                    if (p.legal_hold) {
                      handleAction('legal-hold', { activate: false })
                    } else {
                      const reason = prompt('Motivo da retencao legal:')
                      if (reason) handleAction('legal-hold', { activate: true, reason })
                    }
                  }}
                >
                  {p.legal_hold ? (
                    <>
                      <Unlock className="h-4 w-4" />
                      {actionLoading === 'legal-hold' ? 'Removendo...' : 'Remover Retencao Legal'}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {actionLoading === 'legal-hold' ? 'Ativando...' : 'Ativar Retencao Legal'}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------- Helper components ---------- */

function MetadataItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        {icon && <span className="shrink-0">{icon}</span>}
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
