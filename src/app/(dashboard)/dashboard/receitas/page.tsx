'use client'

import { Construction } from 'lucide-react'

export default function PlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Construction className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h1 className="font-heading text-xl font-medium text-foreground">Em breve</h1>
      <p className="mt-2 text-sm text-muted-foreground">Este módulo está em desenvolvimento</p>
    </div>
  )
}
