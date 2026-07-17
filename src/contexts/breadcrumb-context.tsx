'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface BreadcrumbCtx {
  dynamicLabel: string | null
  setDynamicLabel: (label: string | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbCtx>({
  dynamicLabel: null,
  setDynamicLabel: () => {},
})

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [dynamicLabel, setDynamicLabel] = useState<string | null>(null)
  return (
    <BreadcrumbContext.Provider value={{ dynamicLabel, setDynamicLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export const useBreadcrumbLabel = () => useContext(BreadcrumbContext)
