'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PrescriptionForm } from '@/components/receitas/prescription-form'

export default function NovaReceitaPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/receitas')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">
            Nova Receita
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre uma nova receita para guarda documental
          </p>
        </div>
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>Dados da Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <PrescriptionForm />
        </CardContent>
      </Card>
    </div>
  )
}
