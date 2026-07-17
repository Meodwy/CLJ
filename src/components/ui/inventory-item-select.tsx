'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Check, ChevronDown, Search, Package } from 'lucide-react'

interface Product {
  id: string
  nome: string
  fabricante: string | null
  saldo_atual: number
}

interface InventoryItemSelectProps {
  value: string       // product UUID
  onSelect: (id: string, name: string) => void
  placeholder?: string
}

export function InventoryItemSelect({
  value,
  onSelect,
  placeholder = 'Buscar insumo no estoque...',
}: InventoryItemSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)
    supabase
      .from('produtos')
      .select('id, nome, fabricante, saldo_atual')
      .order('nome', { ascending: true })
      .then(({ data, error: err }) => {
        if (!err && data) setProducts(data as Product[])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query
    ? products.filter(
        (p) =>
          p.nome.toLowerCase().includes(query.toLowerCase()) ||
          (p.fabricante && p.fabricante.toLowerCase().includes(query.toLowerCase())),
      )
    : products

  const handleSelect = useCallback(
    (product: Product) => {
      setQuery('')
      setOpen(false)
      onSelect(product.id, product.nome)
    },
    [onSelect],
  )

  const selected = value ? products.find((p) => p.id === value) : null

  return (
    <div ref={containerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex h-8 w-full items-center rounded-md border px-2 text-sm transition-colors duration-150 ease-[var(--ease-out)]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          open && 'border-ring',
        )}
      >
        <Search className="mr-1.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
        <input
          type="text"
          value={open ? query : selected ? selected.nome : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={open ? placeholder : selected ? selected.nome : placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/40 text-sm"
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3 w-3 text-muted-foreground/40 transition-transform duration-150 ease-[var(--ease-out)]',
              open && 'rotate-180',
            )}
          />
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {filtered.length === 0 ? (
            <li className="flex items-center justify-center py-6 text-xs text-muted-foreground/40">
              {loading ? 'Carregando...' : 'Nenhum insumo encontrado'}
            </li>
          ) : (
            filtered.map((product) => (
              <li
                key={product.id}
                role="option"
                aria-selected={product.id === value}
                onClick={() => handleSelect(product)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(product) }}
                tabIndex={0}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ease-[var(--ease-out)]',
                  'hover:bg-accent hover:text-accent-foreground',
                  product.id === value && 'bg-accent/60 font-medium',
                )}
              >
                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground">{product.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground/50">
                    {product.fabricante ?? 'Sem fabricante'} · Estoque: {product.saldo_atual}
                  </p>
                </div>
                {product.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
