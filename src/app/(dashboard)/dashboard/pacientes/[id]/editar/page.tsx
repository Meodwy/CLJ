'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
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
import { useBreadcrumbLabel } from '@/contexts/breadcrumb-context'

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

export default function EditarPacientePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { setDynamicLabel } = useBreadcrumbLabel()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof PacienteFormData, string>>
  >({})
  const [defaultValues, setDefaultValues] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
  })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        toast.error('Paciente não encontrado')
        router.push('/dashboard/pacientes')
        return
      }

      setDefaultValues({
        nome: data.nome,
        cpf: formatCPFdisplay(data.cpf),
        telefone: formatPhoneDisplay(data.telefone),
        email: data.email || '',
      })
      setDynamicLabel(data.nome)
      setLoading(false)
    }
    load()
    return () => setDynamicLabel(null)
  }, [params.id, router, setDynamicLabel])

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

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('pacientes')
      .update({
        nome: result.data.nome,
        cpf: result.data.cpf,
        telefone: result.data.telefone,
        email: result.data.email || null,
      })
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao salvar paciente')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Paciente atualizado com sucesso!')
    router.push('/dashboard/pacientes')
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('pacientes')
      .delete()
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao excluir paciente')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Paciente excluído')
    router.push('/dashboard/pacientes')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
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
            Editar Paciente
          </h1>
          <p className="text-sm text-muted-foreground">
            Atualize as informações do paciente
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">
            Dados do Paciente
          </CardTitle>
          <CardDescription>
            Altere os campos que deseja atualizar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-[13px] font-medium text-foreground/80">
                Nome completo
              </Label>
              <Input
                id="nome"
                name="nome"
                defaultValue={defaultValues.nome}
                disabled={saving}
                aria-invalid={!!errors.nome}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.nome && (
                <p className="text-[13px] text-destructive">{errors.nome}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cpf" className="text-[13px] font-medium text-foreground/80">
                CPF
              </Label>
              <Input
                id="cpf"
                name="cpf"
                defaultValue={defaultValues.cpf}
                disabled={saving}
                aria-invalid={!!errors.cpf}
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value)
                  e.target.value = formatted
                }}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.cpf && (
                <p className="text-[13px] text-destructive">{errors.cpf}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefone" className="text-[13px] font-medium text-foreground/80">
                Telefone
              </Label>
              <Input
                id="telefone"
                name="telefone"
                defaultValue={defaultValues.telefone}
                disabled={saving}
                aria-invalid={!!errors.telefone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value)
                  e.target.value = formatted
                }}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.telefone && (
                <p className="text-[13px] text-destructive">{errors.telefone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-foreground/80">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={defaultValues.email}
                disabled={saving}
                aria-invalid={!!errors.email}
                className="h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08)]"
              />
              {errors.email && (
                <p className="text-[13px] text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.985]"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-[18px] w-[18px]" />
                    Salvar
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={saving}
                className="h-[46px] rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function formatCPFdisplay(cpf: string) {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

function formatPhoneDisplay(phone: string) {
  if (phone.length === 11)
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  if (phone.length === 10)
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  return phone
}