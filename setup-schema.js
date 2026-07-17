const { Client } = require('pg');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const dbPassword = process.env.SUPABASE_DB_PASSWORD

if (!supabaseUrl || !dbPassword) {
  console.error('Erro: Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_DB_PASSWORD no .env.local')
  console.error('NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co')
  console.error('SUPABASE_DB_PASSWORD=senha_do_banco_postgres')
  process.exit(1)
}

// Extract host from Supabase URL
const dbHost = supabaseUrl.replace('https://', '').replace('.supabase.co', '') + '.supabase.co'

const sql = fs.readFileSync('supabase-schema.sql', 'utf8');

const client = new Client({
  host: dbHost,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Conectando ao Supabase PostgreSQL...');
  await client.connect();
  console.log('Conectado!\n');

  const statements = sql.split(';').filter(s => s.trim().length > 0);
  let ok = 0, errs = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    try {
      await client.query(stmt + ';');
      ok++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        ok++;
      } else {
        console.error('ERRO:', err.message.substring(0, 120));
        errs++;
      }
    }
  }

  await client.end();
  console.log(`\nConcluído! ${ok} OK, ${errs} erros`);
  process.exit(errs > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('FATAL:', e.message);
  console.error('\nDica: tente executar com: node --dns-result-order=ipv4first setup-schema.js');
  process.exit(1);
});