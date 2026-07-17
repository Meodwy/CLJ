'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { PrescriptionTabs } from '@/components/receitas/prescription-tabs'

export default function ReceitasPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const isFarmaceutico = profile?.role === 'farmaceutico' || profile?.role === 'administrador'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">
            Guarda de Receitas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFarmaceutico
              ? 'Gerencie e realize a conferencia documental das receitas'
              : 'Visualize o historico de receitas da clinica'}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/receitas/nova')}>
          <Plus className="h-4 w-4" />
          Nova Receita
        </Button>
      </div>

      {/* Tabs with filtered prescription lists */}
      <PrescriptionTabs />
    </div>
  )
}
