const { Client } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync('C:\\Claudinho\\ProjetoCLJ\\migrations\\003_ia_assistente.sql', 'utf8');

const client = new Client({
  host: '2600:1f16:111a:af01:1159:55b0:243a:8131',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SRK,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Conectando...');
  await client.connect();
  console.log('Conectado!\n');

  const statements = sql.split(';').filter(s => s.trim().length > 0);
  let ok = 0, errs = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    try {
      await client.query(stmt + ';');
      console.log(`  OK [${i+1}/${statements.length}]`);
      ok++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  OK [${i+1}/${statements.length}] (already exists)`);
        ok++;
      } else {
        console.error(`  ERR [${i+1}/${statements.length}]: ${err.message.substring(0, 150)}`);
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
  process.exit(1);
});
