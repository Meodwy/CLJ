const https = require('https');
const fs = require('fs');

const pat = process.env.SUPABASE_SERVICE_ROLE_KEY
const project = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  : undefined

if (!pat || !project) {
  console.error('Erro: Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  console.error('NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co')
  console.error('SUPABASE_SERVICE_ROLE_KEY=sbp_...')
  process.exit(1)
}
const endpoint = '/v1/projects/' + project + '/database/query';

const sql = fs.readFileSync('supabase-financeiro.sql', 'utf8');
const statements = sql.split(';').filter(s => s.trim().length > 0);

function runQuery(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: query + ';' });
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + pat,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Executando SQL via Supabase Management API...\n');
  let ok = 0, skip = 0, errs = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    try {
      const r = await runQuery(stmt);
      if (r.status >= 400) {
        if (r.body.includes('already exists') || r.body.includes('duplicate') || r.body.includes('already been created') || r.body.includes('already been applied')) {
          console.log(`~ #${i} skip (exists)`);
          skip++;
        } else {
          errs++;
          console.error(`✗ #${i} [${r.status}]: ${r.body.substring(0, 200)}`);
        }
      } else {
        console.log(`✓ #${i} ${stmt.substring(0, 55)}...`);
        ok++;
      }
    } catch (e) {
      errs++;
      console.error(`✗ #${i} FATAL: ${e.message}`);
    }
  }

  console.log(`\nConcluído! ${ok} OK, ${skip} skip, ${errs} erros`);
  process.exit(errs > 0 ? 1 : 0);
}

run();
