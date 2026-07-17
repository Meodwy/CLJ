import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'SQL migration file ready at supabase-financeiro.sql. Execute no Supabase SQL Editor.',
    instructions: [
      '1. Abra https://supabase.com/dashboard/project/gqkyjfrbgodcjiciwmbz',
      '2. Vá em SQL Editor',
      '3. Cole o conteúdo de supabase-financeiro.sql',
      '4. Execute',
    ],
  })
}
