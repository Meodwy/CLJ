import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { getFileUrl } from '@/lib/receitas/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da receita é obrigatório' }, { status: 400 })
    }

    // Try to get storage_object_key from body, or look up current version
    let storageObjectKey: string | null = null
    try {
      const body = await request.json()
      storageObjectKey = body?.storage_object_key ?? null
    } catch {
      // No body — look up current version
    }

    if (!storageObjectKey) {
      const admin = createServiceClient()
      const { data: prescription } = await admin
        .from('prescriptions')
        .select('current_version_id')
        .eq('id', id)
        .single()

      if (!prescription?.current_version_id) {
        return NextResponse.json({ error: 'Nenhuma versão atual encontrada' }, { status: 404 })
      }

      const { data: version } = await admin
        .from('prescription_versions')
        .select('storage_object_key')
        .eq('id', prescription.current_version_id)
        .single()

      if (!version) {
        return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })
      }

      storageObjectKey = version.storage_object_key
    }

    if (!storageObjectKey) {
      return NextResponse.json({ error: 'Nenhum arquivo encontrado' }, { status: 404 })
    }

    const signedUrl = await getFileUrl(storageObjectKey)
    return NextResponse.json({ signedUrl })
  } catch (error) {
    console.error('Erro ao gerar URL de download:', error)
    return NextResponse.json(
      { error: 'Erro interno ao gerar URL de download' },
      { status: 500 }
    )
  }
}
