import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'

async function requireRole(token: string, allowedRoles: string[]) {
  const admin = createServiceClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !allowedRoles.includes(profile.role)) return null
  return { id: user.id, role: profile.role }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    // Qualquer role autenticada pode listar usuários
    const admin = createServiceClient()
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // List auth users
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers()
    if (authErr) throw authErr

    // List profiles
    const { data: profiles } = await admin.from('profiles').select('*')

    const users = (authData?.users ?? []).map((au) => {
      const profile = profiles?.find((p) => p.id === au.id)
      return {
        id: au.id,
        email: au.email,
        nome: profile?.nome ?? '',
        role: profile?.role ?? 'atendente',
        created_at: au.created_at,
      }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json(users)
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!await requireRole(token, ['administrador'])) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const body = await request.json()
    const { nome, email, password, role } = body

    if (!nome || !email || !password || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome, email, password, role' }, { status: 400 })
    }

    const admin = createServiceClient()

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, role },
    })

    if (error) throw error

    return NextResponse.json({ id: data.user.id, nome, email, role }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error)
    const msg = error?.message || 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
