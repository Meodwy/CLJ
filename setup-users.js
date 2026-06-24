// Script para criar usuário admin de teste e executar SQL no Supabase
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://gqkyjfrbgodcjiciwmbz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4'
)

async function main() {
  console.log('Criando usuário admin de teste...\n')

  // 1. Criar usuário admin
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'admin@clinica.com',
    password: 'admin123',
    email_confirm: true,
    user_metadata: { nome: 'Administrador', role: 'admin' },
  })

  if (userError) {
    console.error('Erro ao criar usuário admin:', userError.message)
    // Se já existir, tenta listar
    if (userError.message.includes('already') || userError.status === 422) {
      console.log('Usuário já existe, listando...')
      const { data: users } = await supabase.auth.admin.listUsers()
      const admin = users?.users?.find(u => u.email === 'admin@clinica.com')
      if (admin) {
        console.log('Admin encontrado:', admin.id, admin.email)
      }
    }
  } else {
    console.log('✅ Usuário admin criado:')
    console.log('   ID:', user.user.id)
    console.log('   Email:', user.user.email)
  }

  // 2. Criar usuário recepcionista de teste
  const { data: recep, error: recepError } = await supabase.auth.admin.createUser({
    email: 'recepcao@clinica.com',
    password: 'recep123',
    email_confirm: true,
    user_metadata: { nome: 'Maria Recepção', role: 'recepcionista' },
  })

  if (recepError) {
    console.error('Erro ao criar recepcionista:', recepError.message)
    if (recepError.message.includes('already') || recepError.status === 422) {
      console.log('Recepcionista já existe.')
    }
  } else {
    console.log('✅ Recepcionista criado:', recep.user.email)
  }

  console.log('\n---')
  console.log('Credenciais de teste:')
  console.log('  Admin:  admin@clinica.com / admin123')
  console.log('  Recep:  recepcao@clinica.com / recep123')
  console.log('\n⚠️  Execute o SQL em setup-db.sql no SQL Editor do Supabase para criar a tabela profiles:')
  console.log('   https://supabase.com/dashboard/project/gqkyjfrbgodcjiciwmbz/sql/new')
}

main()