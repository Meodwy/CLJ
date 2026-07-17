'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check, Upload, X, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PatientSelect } from '@/components/ui/patient-select'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_ORIGIN_LABELS, type DocumentOrigin } from '@/lib/receitas/types'

const ORIGIN_OPTIONS: { value: DocumentOrigin; label: string }[] = [
  { value: 'NATIVE_DIGITAL', label: DOCUMENT_ORIGIN_LABELS.NATIVE_DIGITAL },
  { value: 'PHYSICAL_SCANNED', label: DOCUMENT_ORIGIN_LABELS.PHYSICAL_SCANNED },
  { value: 'EXTERNAL_DIGITAL', label: DOCUMENT_ORIGIN_LABELS.EXTERNAL_DIGITAL },
]

export function PrescriptionForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Text / date fields
  const [patientName, setPatientName] = useState('')
  const [patientId, setPatientId] = useState('')
  const [prescriberName, setPrescriberName] = useState('')
  const [prescriberRegistration, setPrescriberRegistration] = useState('')
  const [prescriberRegistrationState, setPrescriberRegistrationState] = useState('')
  const [prescriptionType, setPrescriptionType] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [uploadReason, setUploadReason] = useState('')

  // Select / boolean fields
  const [documentOrigin, setDocumentOrigin] = useState<DocumentOrigin>('NATIVE_DIGITAL')
  const [physicalOriginalRequired, setPhysicalOriginalRequired] = useState(false)

  // External-digital conditional fields
  const [externalPlatform, setExternalPlatform] = useState('')
  const [externalId, setExternalId] = useState('')
  const [externalValidationLink, setExternalValidationLink] = useState('')

  const [pharmacists, setPharmacists] = useState<{ id: string; nome: string }[]>([])
  const [loadingPharmacists, setLoadingPharmacists] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('id, nome')
          .eq('role', 'farmaceutico')
          .order('nome')
        if (data) setPharmacists(data)
      } catch (err) {
        console.error('Erro ao carregar farmacêuticos:', err)
      } finally {
        setLoadingPharmacists(false)
      }
    }
    load()
  }, [])

  const handlePrescriberSelect = (id: string) => {
    const selected = pharmacists.find(p => p.id === id)
    if (selected) setPrescriberName(selected.nome)
    else setPrescriberName('')
  }

  const showExternalFields = documentOrigin === 'EXTERNAL_DIGITAL'

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.type.startsWith('image/') || droppedFile.type === 'application/pdf')) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        setError('Arquivo muito grande. Maximo 10 MB.')
        return
      }
      setFile(droppedFile)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      if (f.size > 10 * 1024 * 1024) {
        setError('Arquivo muito grande. Maximo 10 MB.')
        return
      }
      setFile(f)
    }
  }, [])

  const removeFile = useCallback(() => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // 1. Create the prescription
      const body: Record<string, unknown> = {
        patient_id: patientId || '00000000-0000-0000-0000-000000000001',
        prescriber_name: prescriberName,
        prescriber_registration: prescriberRegistration || undefined,
        prescriber_registration_state: prescriberRegistrationState || undefined,
        prescription_type: prescriptionType || undefined,
        document_origin: documentOrigin,
        issued_at: issuedAt || undefined,
        expires_at: expiresAt || undefined,
        physical_original_required: physicalOriginalRequired,
      }

      if (showExternalFields) {
        body.external_platform = externalPlatform || undefined
        body.external_id = externalId || undefined
        body.external_validation_link = externalValidationLink || undefined
      }

      const supabase = createClient()

      // Pega token da sessão (lê cookie, sem network)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetch('/api/receitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: 'Erro ao criar receita' }))
        throw new Error(errBody.message || errBody.error || 'Erro ao criar receita')
      }

      const data = await res.json()
      const prescriptionId = data.id || data.data?.id

      // 2. Upload file if provided
      if (file && prescriptionId) {
        const formData = new FormData()
        formData.append('prescription_id', prescriptionId)
        formData.append('file', file)

        const uploadRes = await fetch('/api/receitas/upload', {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData,
        })

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => 'unknown')
          try { setError(JSON.parse(errText).error) } catch { setError(errText) }
          console.error('Upload failed:', uploadRes.status, errText)
        }
      }

      // 3. Navigate to the detail page
      router.push(`/dashboard/receitas/${prescriptionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar receita')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* === Patient & Prescriber Section === */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Paciente e Prescritor</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PatientSelect
              value={patientId}
              onChange={(id, nome) => {
                setPatientId(id)
                setPatientName(nome)
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescriber-name">Nome do prescritor</Label>
            <div className="relative">
              <select
                id="prescriber-name"
                value={pharmacists.find(p => p.nome === prescriberName)?.id || ''}
                onChange={(e) => handlePrescriberSelect(e.target.value)}
                required
                className={cn(
                  'h-[46px] w-full min-w-0 rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none transition-all duration-150 ease-[var(--ease-out)]',
                  'focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)]',
                  loadingPharmacists && 'opacity-50'
                )}
              >
                <option value="">{loadingPharmacists ? 'Carregando...' : 'Selecione um farmacêutico'}</option>
                {pharmacists.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              {loadingPharmacists && (
                <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground/30" />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescriber-registration">
              Registro profissional{' '}
              <span className="text-muted-foreground/40">(opcional)</span>
            </Label>
            <Input
              id="prescriber-registration"
              value={prescriberRegistration}
              onChange={(e) => setPrescriberRegistration(e.target.value)}
              placeholder="CRM/CRF"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescriber-reg-state">
              UF do registro{' '}
              <span className="text-muted-foreground/40">(opcional)</span>
            </Label>
            <Input
              id="prescriber-reg-state"
              value={prescriberRegistrationState}
              onChange={(e) => setPrescriberRegistrationState(e.target.value)}
              placeholder="SP, RJ, MG..."
              maxLength={2}
              className="w-24 uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prescription-type">
              Tipo de receita{' '}
              <span className="text-muted-foreground/40">(opcional)</span>
            </Label>
            <Input
              id="prescription-type"
              value={prescriptionType}
              onChange={(e) => setPrescriptionType(e.target.value)}
              placeholder="Ex: Receita de controle especial"
            />
          </div>
        </div>
      </section>

      {/* === Document Section === */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Documento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Document origin */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-origin">Origem do documento</Label>
            <select
              id="doc-origin"
              value={documentOrigin}
              onChange={(e) => setDocumentOrigin(e.target.value as DocumentOrigin)}
              className={cn(
                'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors duration-150 ease-[var(--ease-out)]',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
              )}
            >
              {ORIGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Issued at */}
          <div className="space-y-1.5">
            <Label htmlFor="issued-at">
              Data de emissao{' '}
              <span className="text-muted-foreground/40">(opcional)</span>
            </Label>
            <Input
              id="issued-at"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </div>

          {/* Expires at */}
          <div className="space-y-1.5">
            <Label htmlFor="expires-at">
              Data de validade{' '}
              <span className="text-muted-foreground/40">(opcional)</span>
            </Label>
            <Input
              id="expires-at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Physical original required checkbox */}
          <div className="flex items-end pb-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <CheckboxPrimitive.Root
                checked={physicalOriginalRequired}
                onCheckedChange={() => setPhysicalOriginalRequired(!physicalOriginalRequired)}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ease-[var(--ease-out)]',
                  'border-input data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground'
                )}
              >
                <CheckboxPrimitive.Indicator>
                  <Check className="h-3 w-3" />
                </CheckboxPrimitive.Indicator>
              </CheckboxPrimitive.Root>
              <span className="text-muted-foreground">
                Exige original fisico
              </span>
            </label>
          </div>
        </div>

        {/* Conditional external digital fields */}
        {showExternalFields && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-[13px] font-medium text-foreground">
              Dados da receita digital externa
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ext-platform">
                  Plataforma{' '}
                  <span className="text-muted-foreground/40">(opcional)</span>
                </Label>
                <Input
                  id="ext-platform"
                  value={externalPlatform}
                  onChange={(e) => setExternalPlatform(e.target.value)}
                  placeholder="Ex: Prescribe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-id">
                  ID externo{' '}
                  <span className="text-muted-foreground/40">(opcional)</span>
                </Label>
                <Input
                  id="ext-id"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="Codigo na plataforma"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-validation">
                  Link de validacao{' '}
                  <span className="text-muted-foreground/40">(opcional)</span>
                </Label>
                <Input
                  id="ext-validation"
                  value={externalValidationLink}
                  onChange={(e) => setExternalValidationLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* === File Upload Section === */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Arquivo da receita</h2>

        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Upload className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 transition-colors duration-150 ease-[var(--ease-out)]',
              'hover:border-primary/30 hover:bg-primary/5'
            )}
          >
            <Upload className="mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Arraste o arquivo ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground/40">
              PDF, PNG, JPG — max 10 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Upload reason */}
        <div className="space-y-1.5 sm:w-1/2">
          <Label htmlFor="upload-reason">
            Motivo do upload{' '}
            <span className="text-muted-foreground/40">(opcional)</span>
          </Label>
          <Input
            id="upload-reason"
            value={uploadReason}
            onChange={(e) => setUploadReason(e.target.value)}
            placeholder="Ex: Substituicao de versao anterior"
          />
        </div>
      </section>

      {/* === Actions === */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/receitas')}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Criar Receita'}
        </Button>
      </div>
    </form>
  )
}
