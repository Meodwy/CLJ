/**
 * setup-alertas.js
 *
 * Aplica a migration 009_alertas_auto.sql no Supabase PostgreSQL
 * e gera os alertas iniciais.
 *
 * Uso:
 *   SUPABASE_DB_PASSWORD=senha node setup-alertas.js
 *
 * Requer variaveis de ambiente:
 *   NEXT_PUBLIC_SUPABASE_URL (ja em .env.local)
 *   SUPABASE_DB_PASSWORD     (senha do banco postgres)
 *
 * Se SUPABASE_DB_PASSWORD nao estiver definida, o script
 * tenta usar a SRK (service role key) como fallback.
 */

const fs = require('fs')
const path = require('path')

// ── 1. Tentar via Supabase JS client RPC ──
async function tryRpc() {
  try {
    const { createClient } = require('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      console.log('  [RPC] Variaveis de ambiente nao disponiveis, pulando...')
      return false
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { error } = await supabase.rpc('gerar_alertas_estoque')
    if (error) {
      console.log('  [RPC] Funcao gerar_alertas_estoque() ainda nao existe:', error.message.substring(0, 80))
      return false
    }

    console.log('  [RPC] Funcao ja existe e foi executada com sucesso!')
    return true
  } catch (e) {
    console.log('  [RPC] Nao foi possivel testar via RPC:', e.message)
    return false
  }
}

// ── 2. Tentar via pg direct connection ──
async function tryPg() {
  let dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SRK

  if (!dbPassword) {
    console.log('  [PG] SUPABASE_DB_PASSWORD nao definida. Pule ou defina a env var.')
    return false
  }

  const { Client } = require('pg')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.log('  [PG] NEXT_PUBLIC_SUPABASE_URL nao definida.')
    return false
  }

  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const host = `db.${projectRef}.supabase.co`

  const client = new Client({
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log(`  [PG] Conectando a ${host}...`)
    await client.connect()
    console.log('  [PG] Conectado!')

    const sqlPath = path.join(__dirname, 'migrations', '009_alertas_auto.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Remove a ultima linha que gera alertas (sera executada separadamente)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      // Remove the initial SELECT call at the end
      .filter(s => !s.toUpperCase().startsWith('SELECT PUBLIC.GERAR_ALERTAS_ESTOQUE'))

    let ok = 0
    let errs = 0

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i] + ';')
        console.log(`    OK [${i + 1}/${statements.length}]`)
        ok++
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`    OK [${i + 1}/${statements.length}] (already exists)`)
          ok++
        } else {
          console.error(`    ERR [${i + 1}/${statements.length}]: ${err.message.substring(0, 150)}`)
          errs++
        }
      }
    }

    console.log(`\n  [PG] Migration concluida! ${ok} OK, ${errs} erros`)

    // Gerar alertas iniciais
    if (errs === 0) {
      console.log('  [PG] Gerando alertas iniciais...')
      await client.query('SELECT public.gerar_alertas_estoque();')
      console.log('  [PG] Alertas iniciais gerados com sucesso!')
    }

    await client.end()
    return errs === 0
  } catch (e) {
    console.error('  [PG] ERRO:', e.message)
    try { await client.end() } catch {}
    return false
  }
}

// ── 3. Instrucoes manuais ──
function showManualInstructions() {
  const sqlPath = path.join(__dirname, 'migrations', '009_alertas_auto.sql')
  console.log('\n========== INSTRUCOES MANUAIS ==========')
  console.log('Nao foi possivel conectar automaticamente ao banco.')
  console.log('')
  console.log('Opcao 1: Executar via Supabase Dashboard')
  console.log('  1. Acesse https://supabase.com/dashboard/project/gqkyjfrbgodcjiciwmbz')
  console.log('  2. Va para "SQL Editor"')
  console.log('  3. Cole o conteudo do arquivo:')
  console.log(`     ${sqlPath}`)
  console.log('  4. Execute (Ctrl+Enter ou Cmd+Enter)')
  console.log('')
  console.log('Opcao 2: Executar via supabase CLI (se vinculado)')
  console.log('  npx supabase db push')
  console.log('')
  console.log('Opcao 3: Executar via script pg (com senha)')
  console.log('  SUPABASE_DB_PASSWORD=sua_senha_postgres node setup-alertas.js')
  console.log('')
  console.log('A senha do banco esta em:')
  console.log('  Supabase Dashboard > Project Settings > Database > Password')
  console.log('==========================================')
}

// ── Main ──
async function main() {
  console.log('=== Setup Alertas ===\n')

  console.log('1. Testando RPC (funcao ja existe?)...')
  const rpcOk = await tryRpc()

  if (rpcOk) {
    console.log('\nFuncao ja esta instalada e funcional!')
    return
  }

  console.log('\n2. Tentando conexao direta PostgreSQL...')
  const pgOk = await tryPg()

  if (pgOk) {
    console.log('\nSetup concluido com sucesso via pg!')
    return
  }

  console.log('\n3. Nenhum metodo automatico funcionou.')
  showManualInstructions()
  process.exit(1)
}

main().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
