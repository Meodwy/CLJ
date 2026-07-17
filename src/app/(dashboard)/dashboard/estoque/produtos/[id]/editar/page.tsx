'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Trash2, Package, Barcode } from 'lucide-react'
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

const produtoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  nome_comercial: z.string().optional().default(''),
  principio_ativo: z.string().optional().default(''),
  categoria_id: z.string().optional().default(''),
  subcategoria: z.string().optional().default(''),
  fabricante: z.string().optional().default(''),
  codigo_barras: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  registro_anvisa: z.string().optional().default(''),
  unidade_medida: z.string().min(1, 'Selecione uma unidade de medida'),
  quantidade_por_embalagem: z.coerce.number().min(1, 'Deve ser no mínimo 1').default(1),
  estoque_minimo: z.coerce.number().min(0, 'Não pode ser negativo').default(0),
  estoque_maximo: z.coerce.number().min(0, 'Não pode ser negativo').optional().default(0),
})

type ProdutoFormData = z.infer<typeof produtoSchema>

interface CategoriaOption {
  id: string
  nome: string
}

const unidades = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'fr', label: 'Frasco (fr)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'mg', label: 'Miligrama (mg)' },
  { value: 'comp', label: 'Comprimido (comp)' },
  { value: 'amp', label: 'Ampola (amp)' },
]

export default function EditarProdutoPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [defaultValues, setDefaultValues] = useState({
    nome: '',
    nome_comercial: '',
    principio_ativo: '',
    categoria_id: '',
    subcategoria: '',
    fabricante: '',
    codigo_barras: '',
    sku: '',
    registro_anvisa: '',
    unidade_medida: '',
    quantidade_por_embalagem: '1',
    estoque_minimo: '0',
    estoque_maximo: '0',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()

        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome')
        if (cats) setCategorias(cats)

        const { data: produto, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error || !produto) {
          toast.error('Produto não encontrado')
          router.push('/dashboard/estoque/produtos')
          return
        }

        setDefaultValues({
          nome: produto.nome,
          nome_comercial: produto.nome_comercial || '',
          principio_ativo: produto.principio_ativo || '',
          categoria_id: produto.categoria_id || '',
          subcategoria: produto.subcategoria || '',
          fabricante: produto.fabricante || '',
          codigo_barras: produto.codigo_barras || '',
          sku: produto.sku || '',
          registro_anvisa: produto.registro_anvisa || '',
          unidade_medida: produto.unidade_medida,
          quantidade_por_embalagem: String(produto.quantidade_por_embalagem),
          estoque_minimo: String(produto.estoque_minimo),
          estoque_maximo: produto.estoque_maximo ? String(produto.estoque_maximo) : '0',
        })
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar produto')
        router.push('/dashboard/estoque/produtos')
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      nome: (formData.get('nome') as string) || '',
      nome_comercial: (formData.get('nome_comercial') as string) || '',
      principio_ativo: (formData.get('principio_ativo') as string) || '',
      categoria_id: (formData.get('categoria_id') as string) || '',
      subcategoria: (formData.get('subcategoria') as string) || '',
      fabricante: (formData.get('fabricante') as string) || '',
      codigo_barras: (formData.get('codigo_barras') as string) || '',
      sku: (formData.get('sku') as string) || '',
      registro_anvisa: (formData.get('registro_anvisa') as string) || '',
      unidade_medida: (formData.get('unidade_medida') as string) || '',
      quantidade_por_embalagem: formData.get('quantidade_por_embalagem') ? Number(formData.get('quantidade_por_embalagem')) : 1,
      estoque_minimo: formData.get('estoque_minimo') ? Number(formData.get('estoque_minimo')) : 0,
      estoque_maximo: formData.get('estoque_maximo') ? Number(formData.get('estoque_maximo')) : 0,
    }

    const result = produtoSchema.safeParse(data)
    if (!result.success) {
      const fieldErrors: Partial<Record<string, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string
        if (!fieldErrors[field]) fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const supabase = createClient()

    const payload: Record<string, unknown> = {
      nome: result.data.nome,
      nome_comercial: result.data.nome_comercial || null,
      principio_ativo: result.data.principio_ativo || null,
      categoria_id: result.data.categoria_id || null,
      subcategoria: result.data.subcategoria || null,
      fabricante: result.data.fabricante || null,
      codigo_barras: result.data.codigo_barras || null,
      sku: result.data.sku || null,
      registro_anvisa: result.data.registro_anvisa || null,
      unidade_medida: result.data.unidade_medida,
      quantidade_por_embalagem: result.data.quantidade_por_embalagem,
      estoque_minimo: result.data.estoque_minimo,
      estoque_maximo: result.data.estoque_maximo || null,
    }

    const { error } = await supabase
      .from('produtos')
      .update(payload)
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao salvar produto')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Produto atualizado com sucesso!')
    router.push(`/dashboard/estoque/produtos/${params.id}`)
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', params.id)

    if (error) {
      toast.error('Erro ao excluir produto')
      console.error(error)
      setSaving(false)
      return
    }

    toast.success('Produto excluído')
    router.push('/dashboard/estoque/produtos')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const inputClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)]"
  const selectClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] bg-background text-foreground"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-medium text-foreground">Editar Produto</h1>
          <p className="text-sm text-muted-foreground">Atualize as informações do produto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">Dados do Produto</CardTitle>
          <CardDescription>Altere os campos que deseja atualizar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-[13px] font-medium text-foreground/80">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input id="nome" name="nome" defaultValue={defaultValues.nome}
                disabled={saving} aria-invalid={!!errors.nome} className={inputClass} />
              {errors.nome && <p className="text-[13px] text-destructive">{errors.nome}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nome_comercial" className="text-[13px] font-medium text-foreground/80">Nome Comercial</Label>
                <Input id="nome_comercial" name="nome_comercial" defaultValue={defaultValues.nome_comercial} disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="principio_ativo" className="text-[13px] font-medium text-foreground/80">Princípio Ativo</Label>
                <Input id="principio_ativo" name="principio_ativo" defaultValue={defaultValues.principio_ativo} disabled={saving} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="categoria_id" className="text-[13px] font-medium text-foreground/80">Categoria</Label>
                <select id="categoria_id" name="categoria_id" defaultValue={defaultValues.categoria_id} disabled={saving} className={selectClass}>
                  <option value="">Selecione uma categoria</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subcategoria" className="text-[13px] font-medium text-foreground/80">Subcategoria</Label>
                <Input id="subcategoria" name="subcategoria" defaultValue={defaultValues.subcategoria} disabled={saving} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fabricante" className="text-[13px] font-medium text-foreground/80">Fabricante</Label>
                <Input id="fabricante" name="fabricante" defaultValue={defaultValues.fabricante} disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo_barras" className="text-[13px] font-medium text-foreground/80">Código de Barras</Label>
                <div className="relative">
                  <Input id="codigo_barras" name="codigo_barras" defaultValue={defaultValues.codigo_barras}
                    disabled={saving} className={`${inputClass} pr-10`} />
                  <Barcode className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-[13px] font-medium text-foreground/80">SKU</Label>
                <Input id="sku" name="sku" defaultValue={defaultValues.sku} disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registro_anvisa" className="text-[13px] font-medium text-foreground/80">Registro ANVISA</Label>
                <Input id="registro_anvisa" name="registro_anvisa" defaultValue={defaultValues.registro_anvisa} disabled={saving} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="unidade_medida" className="text-[13px] font-medium text-foreground/80">
                  Unidade <span className="text-destructive">*</span>
                </Label>
                <select id="unidade_medida" name="unidade_medida" defaultValue={defaultValues.unidade_medida}
                  disabled={saving} aria-invalid={!!errors.unidade_medida} className={selectClass}>
                  <option value="">Selecione</option>
                  {unidades.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                {errors.unidade_medida && <p className="text-[13px] text-destructive">{errors.unidade_medida}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantidade_por_embalagem" className="text-[13px] font-medium text-foreground/80">Qtd por Embalagem</Label>
                <Input id="quantidade_por_embalagem" name="quantidade_por_embalagem" type="number" min="1"
                  defaultValue={defaultValues.quantidade_por_embalagem} disabled={saving} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="estoque_minimo" className="text-[13px] font-medium text-foreground/80">Estoque Mínimo</Label>
                <Input id="estoque_minimo" name="estoque_minimo" type="number" min="0"
                  defaultValue={defaultValues.estoque_minimo} disabled={saving} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estoque_maximo" className="text-[13px] font-medium text-foreground/80">Estoque Máximo</Label>
                <Input id="estoque_maximo" name="estoque_maximo" type="number" min="0"
                  defaultValue={defaultValues.estoque_maximo} disabled={saving} className={inputClass} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit"
                className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]"
                disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Salvando...</>
                ) : (
                  <><Save className="mr-2 h-[18px] w-[18px]" />Salvar</>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleDelete} disabled={saving}
                className="h-[46px] rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-[18px] w-[18px]" />
              </Button>
              <Button type="button" variant="outline"
                className="h-[46px] rounded-xl text-[15px]"
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