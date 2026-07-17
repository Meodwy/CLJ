// Seed CLJ — Popula pacientes, estoque, agendamentos
// node --dns-result-order=ipv4first seed.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  console.error('Copie de .env.local ou crie um .env com as credenciais')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USERS = {
  admin: 'cabee5b7-0fad-43be-8b6f-9f659f9a7e20',
  farm: 'c0f1e05a-3975-41bf-a328-f12d71e6beee',
  atendente: '3b76bc66-51cd-4dcf-a839-613b709e0010',
  manipulador: '3a131664-ce3f-477c-8c79-a90febe3faef',
  estoquista: '2e7da50e-ed94-4ad9-8675-53997952165a',
  financeiro: '60337102-126f-405c-bdbd-727b9f3d6df0',
};

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) { return arr[randomInt(0, arr.length - 1)]; }

async function main() {
  console.log('=== SEED CLJ ===\n');
  let totalOk = 0, totalErr = 0;

  // ─── 1. CATEGORIAS ───
  console.log('--- Categorias ---');
  const cats = [
    { nome: 'Analgésicos', descricao: 'Medicamentos para dor' },
    { nome: 'Antibióticos', descricao: 'Medicamentos antimicrobianos' },
    { nome: 'Anti-hipertensivos', descricao: 'Controle de pressão arterial' },
    { nome: 'Antidepressivos', descricao: 'Saúde mental' },
    { nome: 'Anti-inflamatórios', descricao: 'Inflamação e dor' },
    { nome: 'Vitaminas e Suplementos', descricao: 'Suplementação nutricional' },
    { nome: 'Dermatológicos', descricao: 'Produtos para pele' },
    { nome: 'Materiais de Curativo', descricao: 'Curativos e gazes' },
    { nome: 'Injetáveis', descricao: 'Medicamentos injetáveis' },
    { nome: 'Controle Especial', descricao: 'Medicamentos controlados' },
  ];
  const catIds = [];
  for (const c of cats) {
    const { data, error } = await supabase.from('categorias').insert(c).select('id');
    if (error) { console.error('  ERRO:', error.message); totalErr++; }
    else { catIds.push(data[0].id); totalOk++; }
  }
  console.log(`  ${cats.length} categorias inseridas`);

  // ─── 2. FORNECEDORES ───
  console.log('\n--- Fornecedores ---');
  const fornecedores = [
    { razao_social: 'MedFarma Distribuidora Ltda', nome_fantasia: 'MedFarma', cnpj: '11222333000181', telefone: '1133334444', email: 'comercial@medfarma.com.br', contato: 'Carlos' },
    { razao_social: 'Farmalab Indústria Farmacêutica S.A.', nome_fantasia: 'Farmalab', cnpj: '44555666000199', telefone: '2144445555', email: 'vendas@farmalab.com.br', contato: 'Ana' },
    { razao_social: 'SaúdePlus Produtos Hospitalares', nome_fantasia: 'SaúdePlus', cnpj: '77888999000111', telefone: '3155556666', email: 'pedidos@saudeplus.com', contato: 'Roberto' },
    { razao_social: 'Biosintética Farma Ltda', nome_fantasia: 'Biosintética', cnpj: '99111222000133', telefone: '4166667777', email: 'contato@biosintetica.com', contato: 'Marina' },
    { razao_social: 'QuimioMais Indústria Química', nome_fantasia: 'QuimioMais', cnpj: '22333444000155', telefone: '1177778888', email: 'sac@quimiomais.com', contato: 'Paulo' },
  ];
  const fornIds = [];
  for (const f of fornecedores) {
    const { data, error } = await supabase.from('fornecedores').insert(f).select('id');
    if (error) { console.error('  ERRO:', error.message); totalErr++; }
    else { fornIds.push(data[0].id); totalOk++; }
  }
  console.log(`  ${fornecedores.length} fornecedores inseridos`);

  // ─── 3. LOCALIZAÇÕES ───
  console.log('\n--- Localizações ---');
  const locais = [
    { setor: 'Farmácia', armario: 'A01', prateleira: 'P1', descricao: 'Armário principal - medicamentos orais' },
    { setor: 'Farmácia', armario: 'A01', prateleira: 'P2', descricao: 'Armário principal - medicamentos orais' },
    { setor: 'Farmácia', armario: 'A02', prateleira: 'P1', descricao: 'Controlados' },
    { setor: 'Farmácia', armario: 'A03', prateleira: 'P1', descricao: 'Injetáveis' },
    { setor: 'Farmácia', armario: 'A03', prateleira: 'P2', descricao: 'Dermatológicos' },
    { setor: 'Farmácia', armario: 'A04', prateleira: 'P1', descricao: 'Vitaminas e suplementos' },
    { setor: 'Farmácia', armario: 'A04', prateleira: 'P2', descricao: 'Materiais de curativo' },
    { setor: 'Farmácia', armario: 'A05', prateleira: 'P1', descricao: 'Anti-inflamatórios' },
    { setor: 'Farmácia', armario: 'B01', prateleira: 'P1', descricao: 'Gaveta de Antibióticos' },
    { setor: 'Farmácia', armario: 'B02', prateleira: 'P1', descricao: 'Antidepressivos' },
    { setor: 'Almoxarifado', armario: 'C01', prateleira: 'P1', descricao: 'Materiais diversos' },
    { setor: 'Almoxarifado', armario: 'C02', prateleira: 'P1', descricao: 'EPIs e descartáveis' },
  ];
  const locIds = [];
  for (const l of locais) {
    const { data, error } = await supabase.from('localizacoes').insert(l).select('id');
    if (error) { console.error('  ERRO:', error.message); totalErr++; }
    else { locIds.push(data[0].id); totalOk++; }
  }
  console.log(`  ${locais.length} localizações inseridas`);

  // ─── 4. PRODUTOS ───
  console.log('\n--- Produtos ---');
  const produtos = [
    { nome: 'Dipirona Sódica 500mg', nome_comercial: 'Dipirona', principio_ativo: 'Dipirona Sódica', categoria_id: catIds[0], fabricante: 'MedFarma', unidade_medida: 'cp', quantidade_por_embalagem: 20, estoque_minimo: 50, estoque_maximo: 300 },
    { nome: 'Paracetamol 750mg', nome_comercial: 'Paracetamol', principio_ativo: 'Paracetamol', categoria_id: catIds[0], fabricante: 'Farmalab', unidade_medida: 'cp', quantidade_por_embalagem: 20, estoque_minimo: 40, estoque_maximo: 250 },
    { nome: 'Ibuprofeno 600mg', nome_comercial: 'Alivium', principio_ativo: 'Ibuprofeno', categoria_id: catIds[4], fabricante: 'Farmalab', unidade_medida: 'cp', quantidade_por_embalagem: 12, estoque_minimo: 30, estoque_maximo: 150 },
    { nome: 'Amoxicilina 500mg', nome_comercial: 'Amoxil', principio_ativo: 'Amoxicilina', categoria_id: catIds[1], fabricante: 'Biosintética', unidade_medida: 'cp', quantidade_por_embalagem: 21, estoque_minimo: 30, estoque_maximo: 200 },
    { nome: 'Azitromicina 500mg', nome_comercial: 'Zitromax', principio_ativo: 'Azitromicina', categoria_id: catIds[1], fabricante: 'Biosintética', unidade_medida: 'cp', quantidade_por_embalagem: 5, estoque_minimo: 20, estoque_maximo: 100 },
    { nome: 'Losartana Potássica 50mg', nome_comercial: 'Losartana', principio_ativo: 'Losartana Potássica', categoria_id: catIds[2], fabricante: 'MedFarma', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 40, estoque_maximo: 200 },
    { nome: 'Enalapril 10mg', nome_comercial: 'Enalapril', principio_ativo: 'Enalapril', categoria_id: catIds[2], fabricante: 'QuimioMais', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 30, estoque_maximo: 150 },
    { nome: 'Sertralina 50mg', nome_comercial: 'Zoloft', principio_ativo: 'Sertralina', categoria_id: catIds[3], fabricante: 'QuimioMais', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 20, estoque_maximo: 100 },
    { nome: 'Fluoxetina 20mg', nome_comercial: 'Prozac', principio_ativo: 'Fluoxetina', categoria_id: catIds[3], fabricante: 'Farmalab', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 20, estoque_maximo: 100 },
    { nome: 'Nimesulida 100mg', nome_comercial: 'Nisulid', principio_ativo: 'Nimesulida', categoria_id: catIds[4], fabricante: 'MedFarma', unidade_medida: 'cp', quantidade_por_embalagem: 12, estoque_minimo: 30, estoque_maximo: 150 },
    { nome: 'Polivitamínico A-Z', nome_comercial: 'Centrum', principio_ativo: 'Multivitamínico', categoria_id: catIds[5], fabricante: 'SaúdePlus', unidade_medida: 'cp', quantidade_por_embalagem: 60, estoque_minimo: 10, estoque_maximo: 80 },
    { nome: 'Vitamina C 1g efervescente', nome_comercial: 'Redoxon', principio_ativo: 'Ácido Ascórbico', categoria_id: catIds[5], fabricante: 'SaúdePlus', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 20, estoque_maximo: 100 },
    { nome: 'Hidratante Corporal 200ml', nome_comercial: 'Cetaphil', principio_ativo: 'Hidratante', categoria_id: catIds[6], fabricante: 'SaúdePlus', unidade_medida: 'un', quantidade_por_embalagem: 1, estoque_minimo: 10, estoque_maximo: 50 },
    { nome: 'Protetor Solar FPS 60', nome_comercial: 'Episol', principio_ativo: 'Fotoprotetor', categoria_id: catIds[6], fabricante: 'Biosintética', unidade_medida: 'un', quantidade_por_embalagem: 1, estoque_minimo: 10, estoque_maximo: 40 },
    { nome: 'Gaze Estéril 7,5cm x 5m', nome_comercial: 'Gaze Cremer', principio_ativo: null, categoria_id: catIds[7], fabricante: 'SaúdePlus', unidade_medida: 'un', quantidade_por_embalagem: 1, estoque_minimo: 20, estoque_maximo: 100 },
    { nome: 'Soro Fisiológico 500ml', nome_comercial: 'SF 0,9%', principio_ativo: 'Cloreto de Sódio', categoria_id: catIds[8], fabricante: 'Farmalab', unidade_medida: 'un', quantidade_por_embalagem: 1, estoque_minimo: 20, estoque_maximo: 60 },
    { nome: 'Dexametasona 4mg injetável', nome_comercial: 'Decadron', principio_ativo: 'Dexametasona', categoria_id: catIds[8], fabricante: 'Biosintética', unidade_medida: 'amp', quantidade_por_embalagem: 1, estoque_minimo: 10, estoque_maximo: 50 },
    { nome: 'Clonazepam 2mg', nome_comercial: 'Rivotril', principio_ativo: 'Clonazepam', categoria_id: catIds[9], fabricante: 'QuimioMais', unidade_medida: 'cp', quantidade_por_embalagem: 30, estoque_minimo: 15, estoque_maximo: 80 },
    { nome: 'Codeína 30mg + Paracetamol 500mg', nome_comercial: 'Tylex', principio_ativo: 'Codeína + Paracetamol', categoria_id: catIds[9], fabricante: 'MedFarma', unidade_medida: 'cp', quantidade_por_embalagem: 12, estoque_minimo: 10, estoque_maximo: 60 },
    { nome: 'Luva de Procedimento Tam M cx 100', nome_comercial: 'Luva Desc', principio_ativo: null, categoria_id: catIds[7], fabricante: 'SaúdePlus', unidade_medida: 'cx', quantidade_por_embalagem: 100, estoque_minimo: 5, estoque_maximo: 20 },
  ];
  const prodIds = [];
  for (const p of produtos) {
    const { data, error } = await supabase.from('produtos').insert(p).select('id');
    if (error) { console.error('  ERRO:', error.message); totalErr++; }
    else { prodIds.push(data[0].id); totalOk++; }
  }
  console.log(`  ${produtos.length} produtos inseridos`);

  // ─── 5. LOTES ───
  console.log('\n--- Lotes ---');
  const lotesData = [];
  for (let i = 0; i < prodIds.length; i++) {
    const qtd = randomInt(1, 3);
    for (let j = 0; j < qtd; j++) {
      const lotNum = `L${String(2026).slice(-2)}${String(randomInt(1, 12)).padStart(2, '0')}${String(randomInt(1, 999)).padStart(3, '0')}`;
      const fabDate = randomDate(new Date('2025-01-01'), new Date('2026-03-01'));
      const validadeOffset = randomInt(30, 365);
      const validade = new Date(fabDate);
      validade.setDate(validade.getDate() + 180 + randomInt(0, 180));

      // Some expired, some near expiry
      const qtdRec = randomInt(10, 200);
      const qtdDisp = randomInt(0, qtdRec);

      lotesData.push({
        produto_id: prodIds[i],
        numero_lote: lotNum,
        data_fabricacao: fabDate.toISOString().split('T')[0],
        data_validade: validade.toISOString().split('T')[0],
        quantidade_recebida: qtdRec,
        quantidade_disponivel: qtdDisp,
        custo_unitario: parseFloat((Math.random() * 80 + 2).toFixed(2)),
        fornecedor_id: pick(fornIds),
        localizacao_id: pick(locIds),
      });
    }
  }
  for (const l of lotesData) {
    const { error } = await supabase.from('lotes').insert(l);
    if (error) { console.error('  ERRO lote:', error.message); totalErr++; }
    else totalOk++;
  }
  console.log(`  ${lotesData.length} lotes inseridos`);

  // ─── 6. PACIENTES ───
  console.log('\n--- Pacientes ---');
  const pacientes = [
    { nome: 'Maria Aparecida Silva', cpf: '12345678901', telefone: '11987654321', email: 'maria.silva@email.com' },
    { nome: 'João Batista Santos', cpf: '23456789012', telefone: '11976543210', email: 'joao.santos@email.com' },
    { nome: 'Ana Beatriz Oliveira', cpf: '34567890123', telefone: '21965432109', email: 'ana.oliveira@email.com' },
    { nome: 'Carlos Eduardo Lima', cpf: '45678901234', telefone: '31954321098', email: 'carlos.lima@email.com' },
    { nome: 'Fernanda Cristina Costa', cpf: '56789012345', telefone: '41943210987', email: 'fernanda.costa@email.com' },
    { nome: 'Pedro Henrique Almeida', cpf: '67890123456', telefone: '51932109876', email: 'pedro.almeida@email.com' },
    { nome: 'Juliana Ferreira Martins', cpf: '78901234567', telefone: '61921098765', email: 'juliana.martins@email.com' },
    { nome: 'Lucas Gabriel Pereira', cpf: '89012345678', telefone: '71910987654', email: 'lucas.pereira@email.com' },
    { nome: 'Patrícia Souza Barbosa', cpf: '90123456789', telefone: '81909876543', email: 'patricia.barbosa@email.com' },
    { nome: 'Rafael Augusto Dias', cpf: '01234567890', telefone: '91998765432', email: 'rafael.dias@email.com' },
    { nome: 'Amanda Lira Nascimento', cpf: '11122233344', telefone: '11911112222', email: 'amanda.nascimento@email.com' },
    { nome: 'Bruno César Rocha', cpf: '22233344455', telefone: '21922223333', email: 'bruno.rocha@email.com' },
    { nome: 'Cíntia Regina Moreira', cpf: '33344455566', telefone: '31933334444', email: 'cintia.moreira@email.com' },
    { nome: 'Diego Ramos Teixeira', cpf: '44455566677', telefone: '41944445555', email: 'diego.teixeira@email.com' },
    { nome: 'Elaine Cristina Farias', cpf: '55566677788', telefone: '51955556666', email: 'elaine.farias@email.com' },
    { nome: 'Felipe Antunes Correia', cpf: '66677788899', telefone: '61966667777', email: 'felipe.correia@email.com' },
    { nome: 'Gabriela Torres Melo', cpf: '77788899900', telefone: '71977778888', email: 'gabriela.melo@email.com' },
    { nome: 'Hugo Leonardo Paz', cpf: '88899900011', telefone: '81988889999', email: 'hugo.paz@email.com' },
    { nome: 'Isabela Nogueira Campos', cpf: '99900011122', telefone: '91999990000', email: 'isabela.campos@email.com' },
    { nome: 'Jorge Luiz Carvalho', cpf: '00011122233', telefone: '11900001111', email: 'jorge.carvalho@email.com' },
  ];
  const pacIds = [];
  for (const p of pacientes) {
    const { data, error } = await supabase.from('pacientes').insert(p).select('id');
    if (error) { console.error('  ERRO:', error.message); totalErr++; }
    else { pacIds.push(data[0].id); totalOk++; }
  }
  console.log(`  ${pacientes.length} pacientes inseridos`);

  // ─── 7. AGENDAMENTOS ───
  console.log('\n--- Agendamentos ---');
  const tipos = ['Consulta', 'Retorno', 'Exame', 'Procedimento', 'Avaliação'];
  const statusList = ['agendado', 'confirmado', 'realizado', 'faltou', 'cancelado'];
  // Generate appointments across June 2026
  const hoje = new Date();
  const agendamentosData = [];
  for (let d = -20; d <= 15; d++) {
    const dt = new Date(hoje);
    dt.setDate(hoje.getDate() + d);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue; // skip weekends

    const numApts = randomInt(1, 6);
    for (let a = 0; a < numApts; a++) {
      const horaBase = randomInt(7, 17);
      const minuto = pick([0, 15, 30, 45]);
      const horaInicio = `${String(horaBase).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
      const horaFim = `${String(horaBase + (minuto + 30 >= 60 ? 1 : 0)).padStart(2, '0')}:${String((minuto + 30) % 60).padStart(2, '0')}`;

      // Past appointments get realistic status
      let status;
      if (d < 0) status = pick(['realizado', 'realizado', 'realizado', 'faltou', 'cancelado']);
      else if (d === 0) status = pick(['confirmado', 'agendado', 'agendado']);
      else status = pick(['agendado', 'agendado', 'confirmado']);

      agendamentosData.push({
        paciente_id: pick(pacIds),
        data: dt.toISOString().split('T')[0],
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        tipo_consulta: pick(tipos),
        status,
        observacao: Math.random() > 0.7 ? 'Paciente relatou dores na região lombar' : null,
        usuario_id: pick([USERS.admin, USERS.atendente, USERS.farm]),
      });
    }
  }
  for (const a of agendamentosData) {
    const { error } = await supabase.from('agendamentos').insert(a);
    if (error) { console.error('  ERRO agendamento:', error.message); totalErr++; }
    else totalOk++;
  }
  console.log(`  ${agendamentosData.length} agendamentos inseridos`);

  // ─── 8. MOVIMENTAÇÕES (histórico de saídas) ───
  console.log('\n--- Movimentações ---');
  const movs = [];
  const tiposMov = ['saida', 'saida', 'saida', 'entrada', 'ajuste'];
  for (let i = 0; i < 50; i++) {
    const dt = randomDate(new Date('2026-05-01'), new Date('2026-07-02'));
    const qtd = randomInt(1, 20);
    movs.push({
      produto_id: pick(prodIds),
      tipo_movimentacao: pick(tiposMov),
      quantidade: qtd,
      usuario_id: pick([USERS.estoquista, USERS.farm, USERS.admin]),
      observacao: Math.random() > 0.6 ? 'Movimentação de rotina' : null,
      created_at: dt.toISOString(),
    });
  }
  for (const m of movs) {
    const { error } = await supabase.from('movimentacoes').insert(m);
    if (error) { console.error('  ERRO mov:', error.message); totalErr++; }
    else totalOk++;
  }
  console.log(`  ${movs.length} movimentações inseridas\n`);

  console.log(`=== FINAL: ${totalOk} ok, ${totalErr} erros ===`);
  console.log('\nPronto! Rode npm run dev e faça login:');
  console.log('  admin@clinica.com / admin123');
  process.exit(totalErr > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });