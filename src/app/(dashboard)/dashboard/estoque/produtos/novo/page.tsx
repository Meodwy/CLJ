'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PackagePlus, Loader2, Search, Package, Barcode } from 'lucide-react'
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
import { useAuth } from '@/contexts/auth-context'
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

interface ProdutoSearch {
  id: string
  nome: string
  codigo_barras: string | null
  saldo_atual: number
  unidade_medida: string
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

export default function NovoProdutoPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const formRef = useRef<HTMLFormElement>(null)

  // Adicionar estoque state
  const [modoAdicionar, setModoAdicionar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProdutoSearch[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduto, setSelectedProduto] = useState<ProdutoSearch | null>(null)
  const [addQuantidade, setAddQuantidade] = useState(0)
  const [addLote, setAddLote] = useState('')
  const [addValidade, setAddValidade] = useState('')
  const [addAnvisa, setAddAnvisa] = useState('')
  const [addCusto, setAddCusto] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadCategorias = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome')
        if (data) setCategorias(data)
      } catch (err) {
        console.error(err)
      }
    }
    loadCategorias()
  }, [])

  useEffect(() => {
    if (modoAdicionar && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [modoAdicionar])

  // Live search with debounce
  const handleSearch = (q: string) => {
    setSearchQuery(q)
    setSelectedProduto(null)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('produtos')
          .select('id, nome, codigo_barras, saldo_atual, unidade_medida')
          .or(`nome.ilike.%${q}%,codigo_barras.ilike.%${q}%`)
          .eq('ativo', true)
          .order('nome')
          .limit(10)
        setSearchResults(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleAddEstoque = async () => {
    if (!selectedProduto) return
    if (addQuantidade <= 0) { toast.error('Quantidade deve ser maior que zero'); return }
    if (!addLote.trim()) { toast.error('Número do lote é obrigatório'); return }
    if (!addValidade) { toast.error('Data de validade é obrigatória'); return }

    setAddLoading(true)
    try {
      const supabase = createClient()
      const loteNumero = addLote.trim()
      const compraId = crypto.randomUUID().slice(0, 8)

      // INSERT lote
      const { data: lote, error: loteError } = await supabase
        .from('lotes')
        .insert({
          produto_id: selectedProduto.id,
          numero_lote: loteNumero,
          data_validade: addValidade,
          quantidade_recebida: addQuantidade,
          quantidade_disponivel: addQuantidade,
          custo_unitario: addCusto ? Number(addCusto) : null,
          registro_anvisa: addAnvisa.trim() || null,
        })
        .select()
        .single()

      if (loteError) { toast.error('Erro ao criar lote'); console.error(loteError); setAddLoading(false); return }

      // INSERT movimentacao entrada
      await supabase
        .from('movimentacoes')
        .insert({
          produto_id: selectedProduto.id,
          lote_id: lote.id,
          tipo_movimentacao: 'entrada',
          quantidade: addQuantidade,
          usuario_id: profile?.id || null,
          observacao: `Adição manual - Lote ${loteNumero}`,
        })

      toast.success(`${addQuantidade} unidades adicionadas ao estoque de "${selectedProduto.nome}"`)
      router.push('/dashboard/estoque/produtos')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao adicionar estoque')
    } finally {
      setAddLoading(false)
    }
  }

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

    setLoading(true)
    const supabase = createClient()

    // Check for duplicate barcode
    if (result.data.codigo_barras) {
      const { data: existing } = await supabase
        .from('produtos')
        .select('id, nome, saldo_atual')
        .eq('codigo_barras', result.data.codigo_barras)
        .maybeSingle()
      if (existing) {
        toast.warning(`Produto "${existing.nome}" ja existe com este codigo de barras. Redirecionando...`)
        setLoading(false)
        router.push(`/dashboard/estoque/produtos/${existing.id}/editar`)
        return
      }
    }

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
      saldo_atual: 0,
      ativo: true,
    }

    const { error } = await supabase.from('produtos').insert(payload)

    if (error) {
      toast.error('Erro ao cadastrar produto')
      console.error(error)
      setLoading(false)
      return
    }

    toast.success('Produto cadastrado com sucesso!')
    router.push('/dashboard/estoque/produtos')
  }

  const inputClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)]"
  const selectClass = "h-[46px] rounded-xl border-border/80 px-4 text-[15px] shadow-sm transition-all duration-150 ease-[var(--ease-out)] ease-[var(--ease-out)] focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_color-mix(in oklch, var(--primary) 8%, transparent)] bg-background text-foreground"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
            Novo Produto
          </h1>
          <p className="text-sm text-muted-foreground">
            {modoAdicionar ? 'Adicione estoque a um produto existente' : 'Cadastre um novo produto no estoque'}
          </p>
        </div>
      </div>

      {/* Toggle: Novo vs Adicionar Estoque */}
      <Card className="border-dashed border-primary/20 bg-primary/[0.02]">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary/60" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {modoAdicionar ? 'Cadastrar novo produto' : 'Produto já existe?'}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {modoAdicionar ? 'Voltar ao formulário de cadastro' : 'Adicione quantidade a um produto já cadastrado'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setModoAdicionar(!modoAdicionar); setSelectedProduto(null); setSearchQuery(''); setSearchResults([]) }}
            className="h-9 rounded-xl text-[13px]">
            {modoAdicionar ? 'Novo Produto' : 'Adicionar Estoque'}
          </Button>
        </CardContent>
      </Card>

      {modoAdicionar ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Adicionar ao Estoque</CardTitle>
            <CardDescription>Busque um produto e adicione quantidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-foreground/80">Buscar Produto</Label>
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  placeholder="Digite nome ou código de barras..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
              </div>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && !selectedProduto && (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-xl border border-border/60">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedProduto(p); setSearchResults([]) }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] transition-colors hover:bg-muted/50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.nome}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {p.codigo_barras && `Cód: ${p.codigo_barras} · `}
                        Estoque: {p.saldo_atual} {p.unidade_medida}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-[13px] text-muted-foreground">Buscando...</p>}
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <p className="text-[13px] text-muted-foreground">Nenhum produto encontrado</p>
            )}

            {/* Selected product */}
            {selectedProduto && (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedProduto.nome}</p>
                    <p className="text-[13px] text-muted-foreground">
                      Estoque atual: {selectedProduto.saldo_atual} {selectedProduto.unidade_medida}
                      {selectedProduto.codigo_barras && ` · Cód: ${selectedProduto.codigo_barras}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduto(null)}
                    className="h-8 text-[13px] text-muted-foreground">
                    Trocar
                  </Button>
                </div>
              </div>
            )}

            {/* Add form */}
            {selectedProduto && (
              <div className="space-y-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Quantidade *</Label>
                    <Input type="number" min="1" value={addQuantidade || ''}
                      onChange={(e) => setAddQuantidade(Number(e.target.value))}
                      placeholder="Quantidade" className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Nº Lote *</Label>
                    <Input value={addLote}
                      onChange={(e) => setAddLote(e.target.value)}
                      placeholder="Número do lote" className={inputClass} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Data de Validade *</Label>
                    <Input type="date" value={addValidade}
                      onChange={(e) => setAddValidade(e.target.value)}
                      className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Registro ANVISA</Label>
                    <Input value={addAnvisa}
                      onChange={(e) => setAddAnvisa(e.target.value)}
                      placeholder="Registro do lote" className={inputClass} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-foreground/80">Custo Unitário</Label>
                    <Input type="number" step="0.01" min="0" value={addCusto}
                      onChange={(e) => setAddCusto(e.target.value)}
                      placeholder="Opcional" className={inputClass} />
                  </div>
                </div>

                <Button onClick={handleAddEstoque} disabled={addLoading}
                  className="h-[46px] w-full rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]">
                  {addLoading ? (
                    <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Adicionando...</>
                  ) : (
                    <><PackagePlus className="mr-2 h-[18px] w-[18px]" />Adicionar ao Estoque</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">
              Dados do Produto
            </CardTitle>
            <CardDescription>
              Preencha as informações do produto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-[13px] font-medium text-foreground/80">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input id="nome" name="nome" placeholder="Nome do produto"
                  disabled={loading} aria-invalid={!!errors.nome} className={inputClass} />
                {errors.nome && <p className="text-[13px] text-destructive">{errors.nome}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nome_comercial" className="text-[13px] font-medium text-foreground/80">
                    Nome Comercial
                  </Label>
                  <Input id="nome_comercial" name="nome_comercial" placeholder="Nome comercial"
                    disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="principio_ativo" className="text-[13px] font-medium text-foreground/80">
                    Princípio Ativo
                  </Label>
                  <Input id="principio_ativo" name="principio_ativo" placeholder="Princípio ativo"
                    disabled={loading} className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="categoria_id" className="text-[13px] font-medium text-foreground/80">
                    Categoria
                  </Label>
                  <select id="categoria_id" name="categoria_id"
                    disabled={loading} className={selectClass}>
                    <option value="">Selecione uma categoria</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subcategoria" className="text-[13px] font-medium text-foreground/80">
                    Subcategoria
                  </Label>
                  <Input id="subcategoria" name="subcategoria" placeholder="Subcategoria"
                    disabled={loading} className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fabricante" className="text-[13px] font-medium text-foreground/80">
                    Fabricante
                  </Label>
                  <Input id="fabricante" name="fabricante" placeholder="Fabricante"
                    disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="codigo_barras" className="text-[13px] font-medium text-foreground/80">
                    Código de Barras
                  </Label>
                  <div className="relative">
                    <Input id="codigo_barras" name="codigo_barras" placeholder="Código de barras"
                      disabled={loading} className={`${inputClass} pr-10`} />
                    <Barcode className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sku" className="text-[13px] font-medium text-foreground/80">
                    SKU
                  </Label>
                  <Input id="sku" name="sku" placeholder="SKU" disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registro_anvisa" className="text-[13px] font-medium text-foreground/80">
                    Registro ANVISA
                  </Label>
                  <Input id="registro_anvisa" name="registro_anvisa" placeholder="Registro ANVISA"
                    disabled={loading} className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="unidade_medida" className="text-[13px] font-medium text-foreground/80">
                    Unidade <span className="text-destructive">*</span>
                  </Label>
                  <select id="unidade_medida" name="unidade_medida"
                    disabled={loading} aria-invalid={!!errors.unidade_medida} className={selectClass}>
                    <option value="">Selecione</option>
                    {unidades.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                  {errors.unidade_medida && <p className="text-[13px] text-destructive">{errors.unidade_medida}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quantidade_por_embalagem" className="text-[13px] font-medium text-foreground/80">
                    Qtd por Embalagem
                  </Label>
                  <Input id="quantidade_por_embalagem" name="quantidade_por_embalagem" type="number" min="1"
                    defaultValue="1" disabled={loading} className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="estoque_minimo" className="text-[13px] font-medium text-foreground/80">
                    Estoque Mínimo
                  </Label>
                  <Input id="estoque_minimo" name="estoque_minimo" type="number" min="0"
                    defaultValue="0" disabled={loading} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estoque_maximo" className="text-[13px] font-medium text-foreground/80">
                    Estoque Máximo
                  </Label>
                  <Input id="estoque_maximo" name="estoque_maximo" type="number" min="0"
                    defaultValue="0" disabled={loading} className={inputClass} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit"
                  className="h-[46px] flex-1 rounded-xl bg-primary text-[15px] font-medium shadow-sm transition-all duration-150 ease-[var(--ease-out)] hover:brightness-110 active:scale-[0.985]"
                  disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />Cadastrando...</>
                  ) : (
                    <><PackagePlus className="mr-2 h-[18px] w-[18px]" />Cadastrar</>
                  )}
                </Button>
                <Button type="button" variant="outline"
                  className="h-[46px] rounded-xl text-[15px]"
                  onClick={() => router.back()} disabled={loading}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
