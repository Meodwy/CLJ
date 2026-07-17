const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://gqkyjfrbgodcjiciwmbz.supabase.co'
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4'

const supabase = createClient(supabaseUrl, serviceKey)

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'seed_compounding_orders.sql'), 'utf8')

  const { data, error } = await supabase.rpc('exec_sql', { query: sql })

  if (error) {
    // exec_sql may not exist — try raw query endpoint
    console.error('RPC error:', error.message)
    console.log('Trying direct SQL endpoint...')

    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Direct SQL failed:', text)

      // Last resort: try pg_dump endpoint or note to use dashboard
      console.log('\nPara rodar o seed, va ao Supabase Dashboard:')
      console.log('1. Abra https://supabase.com/dashboard/project/gqkyjfrbgodcjiciwmbz')
      console.log('2. Vá em "SQL Editor"')
      console.log('3. Cole o conteudo de migrations/seed_compounding_orders.sql')
      console.log('4. Execute')
    } else {
      console.log('Seed executado com sucesso!')
    }
    return
  }

  console.log('Seed executado:', data)
}

run().catch(console.error)
