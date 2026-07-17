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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const adminUser = await requireRole(token, ['administrador'])
    if (!adminUser) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!role) return NextResponse.json({ error: 'Campo obrigatório: role' }, { status: 400 })

    // Não permite admin mudar própria role
    if (id === adminUser.id) {
      return NextResponse.json({ error: 'Não é possível alterar sua própria função' }, { status: 400 })
    }

    const admin = createServiceClient()
    const { error } = await admin.from('profiles').update({ role }).eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const adminUser = await requireRole(token, ['administrador'])
    if (!adminUser) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { id } = await params

    // Não permite deletar a si mesmo
    if (id === adminUser.id) {
      return NextResponse.json({ error: 'Não é possível excluir seu próprio usuário' }, { status: 400 })
    }

    const admin = createServiceClient()

    // Nullify references antes de deletar
    const nullifyTables = ['compras', 'movimentacoes', 'inventarios', 'agendamentos', 'vendas']
    for (const table of nullifyTables) {
      await admin.from(table as any).update({ usuario_id: null }).eq('usuario_id', id)
    }

    // Delete auth user (ON DELETE CASCADE remove profile)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
