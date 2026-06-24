'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const pacienteSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf: z
    .string()
    .min(11, 'CPF inválido')
    .max(14, 'CPF inválido')
    .transform((v) => v.replace(/\D/g, '')),
  telefone: z
    .string()
    .min(10, 'Telefone inválido')
    .transform((v) => v.replace(/\D/g, '')),
  email: z.string().email('Email inválido').or(z.literal('')),
})

type PacienteFormData = z.infer<typeof pacienteSchema>

export default function CadastroPacientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof PacienteFormData, string>>
  >({})

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 7)
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      nome: (formData.get('nome') as string) || '',
      cpf: (formData.get('cpf') as string) || '',
      telefone: (formData.get('telefone') as string) || '',
      email: (formData.get('email') as string) || '',
    }

    const result = pacienteSchema.safeParse(data)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PacienteFormData, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof PacienteFormData
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('pacientes').insert({
      nome: result.data.nome,
      cpf: result.data.cpf,
      telefone: result.data.telefone,
      email: result.data.email || null,
    })

    if (error) {
      if (error.code === '23505') {
        toast.error('CPF já cadastrado')
      } else {
        toast.error('Erro ao cadastrar paciente')
        console.error(error)
      }
      setLoading(false)
      return
    }

    toast.success('Paciente cadastrado com sucesso!')
    router.push('/dashboard/pacientes')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">
            Novo Paciente
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um novo paciente no sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">
            Dados do Paciente
          </CardTitle>
          <CardDescription>
            Preencha as informações básicas do paciente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="nome"
                className="text-[13px] font-medium text-foreground/80"
              >
                Nome completo
              </Label>
              <Input
                id="nome"
                name="nome"
                placeholder="Nome do paciente"
                disabled={loading}
                aria-invalid={!!errors.nome}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.nome && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  {errors.nome}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="cpf"
                className="text-[13px] font-medium text-foreground/80"
              >
                CPF
              </Label>
              <Input
                id="cpf"
                name="cpf"
                placeholder="000.000.000-00"
                disabled={loading}
                aria-invalid={!!errors.cpf}
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value)
                  e.target.value = formatted
                }}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.cpf && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  {errors.cpf}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="telefone"
                className="text-[13px] font-medium text-foreground/80"
              >
                Telefone
              </Label>
              <Input
                id="telefone"
                name="telefone"
                placeholder="(11) 99999-9999"
                disabled={loading}
                aria-invalid={!!errors.telefone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value)
                  e.target.value = formatted
                }}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.telefone && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  {errors.telefone}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[13px] font-medium text-foreground/80"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="paciente@email.com"
                disabled={loading}
                aria-invalid={!!errors.email}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.email && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.985]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-[18px] w-[18px]" />
                    Cadastrar
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-[46px] rounded-xl text-[15px]"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
