'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Building2, Loader2, Trash2 } from 'lucide-react'
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

const fornecedorSchema = z.object({
  razao_social: z.string().min(3, 'Razão social deve ter no mínimo 3 caracteres'),
  nome_fantasia: z.string().optional().default(''),
  cnpj: z.string().optional().default(''),
  telefone: z.string().optional().default(''),
  email: z.string().email('Email inválido').or(z.literal('')).optional().default(''),
  endereco: z.string().optional().default(''),
  contato: z.string().optional().default(''),
})

type FornecedorFormData = z.infer<typeof fornecedorSchema>

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function EditarFornecedorPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { setDynamicLabel } = useBreadcrumbLabel()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FornecedorFormData, string>>>({})
  const [razaoSocial, setRazaoSocial] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fornecedores')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error || !data) {
          toast.error('Fornecedor não encontrado')
          router.push('/dashboard/estoque/fornecedores')
          return
        }

        setRazaoSocial(data.razao_social)
        setDynamicLabel(data.razao_social)

        // Fill form fields
        const form = document.forms.namedItem('editar-fornecedor')
        if (form) {
          ;(form.elements.namedItem('razao_social') as HTMLInputElement).value = data.razao_social
          ;(form.elements.namedItem('nome_fantasia') as HTMLInputElement).value = data.nome_fantasia || ''
          ;(form.elements.namedItem('cnpj') as HTMLInputElement).value = data.cnpj || ''
          ;(form.elements.namedItem('telefone') as HTMLInputElement).value = data.telefone || ''
          ;(form.elements.namedItem('email') as HTMLInputElement).value = data.email || ''
          ;(form.elements.namedItem('endereco') as HTMLInputElement).value = data.endereco || ''
          ;(form.elements.namedItem('contato') as HTMLInputElement).value = data.contato || ''
        }
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar fornecedor')
        router.push('/dashboard/estoque/fornecedores')
      }
      setLoading(false)
    }
    load()
    return () => setDynamicLabel(null)
  }, [params.id, router, setDynamicLabel])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      razao_social: (formData.get('razao_social') as string) || '',
      nome_fantasia: (formData.get('nome_fantasia') as string) || '',
      cnpj: ((formData.get('cnpj') as string) || '').replace(/\D/g, ''),
      telefone: (formData.get('telefone') as string) || '',
      email: (formData.get('email') as string) || '',
      endereco: (formData.get('endereco') as string) || '',
      contato: (formData.get('contato') as string) || '',
    }

    const result = fornecedorSchema.safeParse(data)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FornecedorFormData, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof FornecedorFormData
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('fornecedores')
      .update({
        razao_social: result.data.razao_social,
        nome_fantasia: result.data.nome_fantasia || null,
        cnpj: result.data.cnpj || null,
        telefone: result.data.telefone || null,
        email: result.data.email || null,
        endereco: result.data.endereco || null,
        contato: result.data.contato || null,
      })
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao salvar fornecedor')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Fornecedor atualizado com sucesso!')
    router.push('/dashboard/estoque/fornecedores')
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('fornecedores')
      .delete()
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao excluir fornecedor')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Fornecedor excluído')
    router.push('/dashboard/estoque/fornecedores')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const inputClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)]"

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">Editar Fornecedor</h1>
          <p className="text-sm text-muted-foreground">Atualize as informações do fornecedor</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">Dados do Fornecedor</CardTitle>
          <CardDescription>Altere os campos que deseja atualizar</CardDescription>
        </CardHeader>
        <CardContent>
          <form name="editar-fornecedor" onSubmit={handleSubmit} className="space-y-5">
            {/* Razão Social */}
            <div className="space-y-1.5">
              <Label htmlFor="razao_social" className="text-[13px] font-medium text-foreground/80">
                Razão Social <span className="text-destructive">*</span>
              </Label>
              <Input id="razao_social" name="razao_social" placeholder="Razão social do fornecedor"
                disabled={saving} aria-invalid={!!errors.razao_social} className={inputClass} />
              {errors.razao_social && <p className="text-[13px] text-destructive">{errors.razao_social}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nome_fantasia" className="text-[13px] font-medium text-foreground/80">Nome Fantasia</Label>
                <Input id="nome_fantasia" name="nome_fantasia" placeholder="Nome fantasia" disabled={saving} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-[13px] font-medium text-foreground/80">CNPJ</Label>
                <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" disabled={saving}
                  onChange={(e) => { const f = formatCNPJ(e.target.value); e.target.value = f }}
                  className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-[13px] font-medium text-foreground/80">Telefone</Label>
                <Input id="telefone" name="telefone" placeholder="(11) 99999-9999" disabled={saving} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium text-foreground/80">Email</Label>
                <Input id="email" name="email" type="email" placeholder="fornecedor@email.com" disabled={saving}
                  aria-invalid={!!errors.email} className={inputClass} />
                {errors.email && <p className="text-[13px] text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endereco" className="text-[13px] font-medium text-foreground/80">Endereço</Label>
              <Input id="endereco" name="endereco" placeholder="Endereço completo" disabled={saving} className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contato" className="text-[13px] font-medium text-foreground/80">Contato</Label>
              <Input id="contato" name="contato" placeholder="Nome do contato" disabled={saving} className={inputClass} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit"
                className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]"
                disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Salvando...</>
                ) : (
                  <><Building2 className="mr-2 h-[18px] w-[18px]" />Salvar</>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleDelete} disabled={saving}
                className="h-[46px] rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-[18px] w-[18px]" />
              </Button>
              <Button type="button" variant="outline" className="h-[46px] rounded-xl text-[15px]"
                onClick={() => router.back()} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
