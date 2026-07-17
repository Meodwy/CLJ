import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiter in-memory (funciona bem em serverless pois instâncias são reutilizadas)
const rateLimit = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000 // 1 minuto
const MAX_ATTEMPTS = 5

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimit.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS }
  }

  const remaining = MAX_ATTEMPTS - entry.count
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: remaining - 1, resetAt: entry.resetAt }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, remaining, resetAt } = checkRateLimit(ip)

  // Sempre retorna headers de rate limit
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(MAX_ATTEMPTS),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas de login. Aguarde 1 minuto.' },
      { status: 429, headers: rateLimitHeaders }
    )
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha obrigatórios' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json(
        { error: 'Email ou senha incorretos' },
        { status: 401, headers: rateLimitHeaders }
      )
    }

    return NextResponse.json(
      { session: data.session, user: data.user },
      { headers: rateLimitHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
