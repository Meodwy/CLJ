import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from './client'

let cached: ReturnType<typeof createClient> | null = null

export async function createDirectClient() {
  // Get auth session from SSR client (reads cookies)
  const ssrClient = createSsrClient()
  const { data: { session } } = await ssrClient.auth.getSession()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase URL/KEY missing')

  // Create client without SSR cookie storage but with auth token
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    },
  })
  return cached
}
