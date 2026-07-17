-- ============================================================
-- CLJ Clínica — Módulo Financeiro
-- Tabelas: vendas, itens_venda, despesas
-- ============================================================

-- 1. VENDAS (receita / money in)
CREATE TABLE IF NOT EXISTS vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id),
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro'
    CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','pix','boleto','convenio','outros')),
  usuario_id UUID REFERENCES profiles(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendas_select ON vendas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY vendas_insert ON vendas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY vendas_update ON vendas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY vendas_delete ON vendas FOR DELETE USING (auth.uid() IS NOT NULL);

-- 2. ITENS_VENDA
CREATE TABLE IF NOT EXISTS itens_venda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_venda_select ON itens_venda FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY itens_venda_insert ON itens_venda FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. DESPESAS (saidas / money out)
CREATE TABLE IF NOT EXISTS despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'operacional'
    CHECK (tipo IN ('aluguel','salario','agua','energia','telefone','internet',
                    'material_escritorio','manutencao','marketing','impostos',
                    'compra_produtos','operacional','outros')),
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_despesa DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT DEFAULT 'dinheiro'
    CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','pix','boleto','transferencia','outros')),
  fornecedor_id UUID REFERENCES fornecedores(id),
  usuario_id UUID REFERENCES profiles(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY despesas_select ON despesas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY despesas_insert ON despesas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY despesas_update ON despesas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY despesas_delete ON despesas FOR DELETE USING (auth.uid() IS NOT NULL);

-- Grant access via REST API for all tables
GRANT ALL ON vendas TO authenticated, service_role;
GRANT ALL ON itens_venda TO authenticated, service_role;
GRANT ALL ON despesas TO authenticated, service_role;
