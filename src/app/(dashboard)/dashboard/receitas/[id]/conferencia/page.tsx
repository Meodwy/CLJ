'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DocumentViewer } from '@/components/receitas/document-viewer'
import { PrescriptionStatusBadge } from '@/components/receitas/prescription-status-badge'
import { ChecklistForm, type ChecklistFormData } from '@/components/receitas/checklist-form'
import { SignatureDialog, type SignatureData } from '@/components/receitas/signature-dialog'
import { ArrowLeft, Loader2, FileText, User, Stethoscope, Calendar } from 'lucide-react'
import { DOCUMENT_ORIGIN_LABELS, type Prescription, type PrescriptionVersion } from '@/lib/receitas/types'

interface ConferenciaPrescription extends Prescription {
  patient?: { id: string; nome: string } | null
  versions?: PrescriptionVersion[]
}

export default function ConferenciaPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const id = params?.id as string

  const [prescription, setPrescription] = useState<ConferenciaPrescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

  // CRF fields (entered by pharmacist before review)
  const [crfNumber, setCrfNumber] = useState('')
  const [crfState, setCrfState] = useState('')

  const isFarmaceutico = profile?.role === 'farmaceutico' || profile?.role === 'administrador'

  const fetchPrescription = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/receitas/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar receita')
      const json = await res.json()
      const p = json.data || json
      setPrescription(p)
      // Pre-fill CRF from profile if available
      if (p.reviews?.[0]?.crf_number) setCrfNumber(p.reviews[0].crf_number)
      if (p.reviews?.[0]?.crf_state) setCrfState(p.reviews[0].crf_state)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchPrescription()
  }, [fetchPrescription])

  const handleReviewSubmit = async (data: ChecklistFormData) => {
    if (!prescription || !profile) return
    setReviewSubmitting(true)
    try {
      const currentVersion = prescription.versions?.find((v) => v.is_current)
      if (!currentVersion) throw new Error('Nenhuma versao atual encontrada')

      if (!crfNumber || !crfState) {
        throw new Error('Informe seu CRF e estado antes de conferir')
      }

      const body: Record<string, unknown> = {
        decision: data.decision,
        notes: data.notes || undefined,
        prescription_version_id: currentVersion.id,
        pharmacist_id: profile!.id,
        pharmacist_name: profile!.nome,
        crf_number: crfNumber,
        crf_state: crfState,
        document_legible: data.checklist.document_legible ?? false,
        patient_verified: data.checklist.patient_verified ?? false,
        prescriber_verified: data.checklist.prescriber_verified ?? false,
        prescriber_registration_verified: data.checklist.prescriber_registration_verified ?? false,
        prescriber_signature_verified: data.checklist.prescriber_signature_verified ?? false,
        issue_date_verified: data.checklist.issue_date_verified ?? false,
        document_complete: data.checklist.document_complete ?? false,
        document_origin_verified: data.checklist.document_origin_verified ?? false,
        file_patient_match: data.checklist.file_patient_match ?? false,
        no_visible_tampering: data.checklist.no_visible_tampering ?? false,
        physical_location_verified: data.checklist.physical_location_verified ?? null,
        final_checklist_confirmed: data.checklist.final_checklist_confirmed ?? false,
      }

      const supabase = (await import('@/lib/supabase/client')).createClient()
      await supabase.auth.getUser() // refresh token
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/receitas/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: 'Erro ao salvar conferencia' }))
        throw new Error(errBody.message || errBody.error || 'Erro ao salvar conferencia')
      }

      toast.success('Conferencia registrada')
      router.push(`/dashboard/receitas/${id}`)
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleSign = async (signatureData: SignatureData) => {
    if (!reviewId) throw new Error('Nenhuma revisao encontrada para assinar')

    const supabase = (await import('@/lib/supabase/client')).createClient()
    await supabase.auth.getUser() // refresh token
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/receitas/${id}/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        review_id: reviewId,
        pharmacist_id: profile!.id,
        signature_method: signatureData.signature_method,
        certificate_subject: signatureData.certificate_subject,
        certificate_issuer: signatureData.certificate_issuer,
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: 'Erro na assinatura' }))
      throw new Error(errBody.message || errBody.error || 'Erro na assinatura')
    }

    router.push(`/dashboard/receitas/${id}`)
  }

  if (!isFarmaceutico) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-destructive">Acesso restrito a farmaceuticos</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/receitas')}>
          Voltar
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (error || !prescription) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-destructive">{error || 'Receita nao encontrada'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/receitas')}>
          Voltar
        </Button>
      </div>
    )
  }

  const currentVersion = prescription.versions?.find((v) => v.is_current)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/receitas/${prescription.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl font-medium text-foreground">Conferencia Documental</h1>
            <PrescriptionStatusBadge status={prescription.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Receita #{prescription.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      {/* CRF info fields */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Identificacao do Farmaceutico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="crf-number" className="mb-1.5 block text-sm font-medium text-foreground">
                CRF Numero
              </Label>
              <Input
                id="crf-number"
                value={crfNumber}
                onChange={(e) => setCrfNumber(e.target.value)}
                placeholder="Ex: 12345"
              />
            </div>
            <div className="w-20">
              <Label htmlFor="crf-state" className="mb-1.5 block text-sm font-medium text-foreground">
                UF
              </Label>
              <Input
                id="crf-state"
                value={crfState}
                onChange={(e) => setCrfState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {currentVersion ? (
            <DocumentViewer prescriptionId={prescription.id} height={700} />
          ) : (
            <div className="flex items-center justify-center rounded-xl bg-muted/30 py-16 text-sm text-muted-foreground">
              <FileText className="mr-2 h-5 w-5 text-muted-foreground/30" />
              Nenhum documento anexado
            </div>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Resumo da Receita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <span className="text-muted-foreground">Paciente:</span>
                <span className="font-medium text-foreground">
                  {prescription.patient?.nome || prescription.patient_id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <span className="text-muted-foreground">Prescritor:</span>
                <span className="font-medium text-foreground">{prescription.prescriber_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <span className="text-muted-foreground">Emissao:</span>
                <span className="font-medium text-foreground">
                  {prescription.issued_at ? new Date(prescription.issued_at).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <span className="text-muted-foreground">Origem:</span>
                <span className="font-medium text-foreground">
                  {DOCUMENT_ORIGIN_LABELS[prescription.document_origin] || prescription.document_origin}
                </span>
              </div>
              {currentVersion && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <span className="text-muted-foreground">Arquivo:</span>
                  <span className="font-medium text-foreground">
                    {currentVersion.original_filename || `V${currentVersion.version_number}`}
                  </span>
                  <span className="text-xs text-muted-foreground/40">
                    ({(currentVersion.file_size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <ChecklistForm
            onSubmit={handleReviewSubmit}
            onProceedToSignature={() => setSignatureOpen(true)}
            submitting={reviewSubmitting}
          />
        </div>
      </div>

      <SignatureDialog
        prescriptionId={prescription.id}
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onSign={handleSign}
      />
    </div>
  )
}
