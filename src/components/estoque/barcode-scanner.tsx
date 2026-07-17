'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void
  placeholder?: string
}

export function BarcodeScanner({ onDetected, placeholder = 'Digite ou escaneie o código de barras' }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [mount, setMount] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMount(true), 30)
    return () => clearTimeout(t)
  }, [])

  const startScan = async () => {
    try {
      if (!('BarcodeDetector' in window)) {
        toast.error('Leitor não suportado neste navegador. Digite o código manualmente.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setScanning(true)
      detectBarcode()
    } catch (err) {
      toast.error('Erro ao acessar câmera')
    }
  }

  const detectBarcode = async () => {
    if (!videoRef.current || !('BarcodeDetector' in window)) return
    const detector = new (window as any).BarcodeDetector()

    const detect = async () => {
      if (!scanning) return
      try {
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) {
          onDetected(barcodes[0].rawValue)
          stopScan()
          return
        }
      } catch {}
      requestAnimationFrame(detect)
    }
    detect()
  }

  const stopScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    setScanning(false)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualValue.trim()) {
      onDetected(manualValue.trim())
      setManualValue('')
    }
  }

  return (
    <div className={cn('space-y-2 transition-opacity duration-300', mount ? 'opacity-100' : 'opacity-0')}>
      {scanning && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/50">
          <video ref={videoRef} className="h-48 w-full object-cover" />
          <button
            type="button"
            onClick={stopScan}
            className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors duration-150 ease-[var(--ease-out)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <form onSubmit={handleManualSubmit} className="flex-1">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={placeholder}
            className="h-[46px] w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] transition-colors duration-150 ease-[var(--ease-out)]"
          />
        </form>
        <button
          type="button"
          onClick={startScan}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-border/80 text-muted-foreground hover:bg-muted transition-colors duration-150 ease-[var(--ease-out)]"
          title="Escanear código de barras"
        >
          <Camera className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}