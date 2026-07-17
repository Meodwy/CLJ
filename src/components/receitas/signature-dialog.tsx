'use client'

import { useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SignatureMethod } from '@/lib/receitas/types'

export interface SignatureData {
  signature_method: SignatureMethod
  password: string
  certificate_subject?: string
  certificate_issuer?: string
}

interface SignatureDialogProps {
  prescriptionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSign: (data: SignatureData) => Promise<void>
}

export function SignatureDialog({
  prescriptionId,
  open,
  onOpenChange,
  onSign,
}: SignatureDialogProps) {
  const [method, setMethod] = useState<SignatureMethod>('ADVANCED_ELECTRONIC_SIGNATURE')
  const [password, setPassword] = useState('')
  const [certSubject, setCertSubject] = useState('')
  const [certIssuer, setCertIssuer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSign({
        signature_method: method,
        password,
        ...(method === 'ICP_BRASIL_QUALIFIED_SIGNATURE'
          ? {
              certificate_subject: certSubject || undefined,
              certificate_issuer: certIssuer || undefined,
            }
          : {}),
      })
      onOpenChange(false)
    } catch {
      // Error handling is delegated to the parent
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/40 transition-opacity duration-150 ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />

        <DialogPrimitive.Popup
          className={cn(
            'fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10 outline-none',
            'transition-all duration-150 ease-[var(--ease-out)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0'
          )}
        >
          <DialogPrimitive.Title className="text-base font-medium text-foreground">
            Assinatura do Farmaceutico
          </DialogPrimitive.Title>

          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A assinatura do farmaceutico confirma somente a conferencia documental e o
            aceite de guarda da receita, nos termos da RDC 585/2021 e RDC 602/2021.
            Esta assinatura nao substitui a prescricao medica nem atesta a validade
            clinica do conteudo prescrito.
          </DialogPrimitive.Description>

          <div className="mt-6 space-y-4">
            {/* Signature method selector */}
            <div>
              <Label className="mb-2 block text-sm font-medium text-foreground">
                Metodo de assinatura
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('ADVANCED_ELECTRONIC_SIGNATURE')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)]',
                    method === 'ADVANCED_ELECTRONIC_SIGNATURE'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/20'
                  )}
                >
                  <Fingerprint className="h-5 w-5" />
                  <span className="font-medium">Assinatura Avancada</span>
                  <span className="text-center text-[10px] text-muted-foreground/60">
                    Senha de acesso
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('ICP_BRASIL_QUALIFIED_SIGNATURE')}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)]',
                    method === 'ICP_BRASIL_QUALIFIED_SIGNATURE'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/20'
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span className="font-medium">ICP-Brasil</span>
                  <span className="text-center text-[10px] text-muted-foreground/60">
                    Certificado Digital
                  </span>
                </button>
              </div>
            </div>

            {/* Password / PIN */}
            <div>
              <Label
                htmlFor="sig-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {method === 'ADVANCED_ELECTRONIC_SIGNATURE'
                  ? 'Senha de acesso'
                  : 'Senha do certificado / PIN'}
              </Label>
              <Input
                id="sig-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              />
            </div>

            {/* Certificate fields (ICP-Brasil only) */}
            {method === 'ICP_BRASIL_QUALIFIED_SIGNATURE' && (
              <>
                <div>
                  <Label
                    htmlFor="sig-cert-subject"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Titular do certificado{' '}
                    <span className="text-muted-foreground/40">(opcional)</span>
                  </Label>
                  <Input
                    id="sig-cert-subject"
                    value={certSubject}
                    onChange={(e) => setCertSubject(e.target.value)}
                    placeholder="Nome do titular"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="sig-cert-issuer"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Autoridade certificadora{' '}
                    <span className="text-muted-foreground/40">(opcional)</span>
                  </Label>
                  <Input
                    id="sig-cert-issuer"
                    value={certIssuer}
                    onChange={(e) => setCertIssuer(e.target.value)}
                    placeholder="Ex: Soluti, Certisign"
                  />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <DialogPrimitive.Close
              render={
                <Button variant="outline" disabled={submitting}>
                  Cancelar
                </Button>
              }
            />
            <Button
              disabled={!password || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Assinando...' : 'Assinar Receita'}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
