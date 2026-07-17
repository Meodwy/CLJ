'use client'

import { useState, useEffect } from 'react'
import { Loader2, FileX } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentViewerProps {
  prescriptionId: string
  className?: string
  /** Override the default height (default: 600px). */
  height?: number | string
}

export function DocumentViewer({
  prescriptionId,
  className,
  height = 600,
}: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadUrl = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/receitas/${prescriptionId}/file-url`, {
          method: 'POST',
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || 'Falha ao carregar documento')
        }
        const data = await res.json()
        if (!cancelled) {
          // Accept multiple possible response shapes
          setFileUrl(data.url || data.signedUrl || data.signed_url || data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUrl()
    return () => {
      cancelled = true
    }
  }, [prescriptionId])

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-muted/30',
          className
        )}
        style={{ height: typeof height === 'number' ? height : height }}
      >
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          <span>Carregando documento...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-muted/30',
          className
        )}
        style={{ height: typeof height === 'number' ? height : height }}
      >
        <div className="flex flex-col items-center gap-2 text-sm text-destructive">
          <FileX className="h-8 w-8 text-destructive/40" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('overflow-hidden rounded-xl ring-1 ring-foreground/10', className)}
    >
      <iframe
        src={fileUrl!}
        className="w-full"
        style={{ height: typeof height === 'number' ? height : height }}
        title="Documento da receita"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
