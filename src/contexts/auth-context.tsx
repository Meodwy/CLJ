'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export type Role = 'administrador' | 'farmaceutico' | 'atendente' | 'manipulador' | 'estoquista' | 'financeiro'

export interface Profile {
  id: string
  nome: string
  role: Role
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, role, created_at')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabaseRef.current = supabase

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const currentUser = data.session?.user ?? null
        setUser(currentUser)
        setLoading(false) // CRITICAL: fire immediately

        if (currentUser) {
          // Load profile in background — never blocks UI
          fetchProfile(supabase, currentUser.id).then(setProfile)
        }
      } catch {
        setLoading(false)
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          fetchProfile(supabase, currentUser.id).then(setProfile)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current
    if (!supabase) return

    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}