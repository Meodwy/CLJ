-- ============================================================
-- CLJ Clínica — Full Schema (Estoque + Agendamentos)
-- Executar no SQL Editor do Supabase
-- ============================================================

-- 1. CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_select ON categorias FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY categorias_insert ON categorias FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY categorias_update ON categorias FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY categorias_delete ON categorias FOR DELETE USING (auth.uid() IS NOT NULL);

-- 2. FORNECEDORES
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  contato TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY fornecedores_select ON fornecedores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY fornecedores_insert ON fornecedores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fornecedores_update ON fornecedores FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY fornecedores_delete ON fornecedores FOR DELETE USING (auth.uid() IS NOT NULL);

-- 3. LOCALIZACOES
CREATE TABLE IF NOT EXISTS localizacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setor TEXT NOT NULL,
  armario TEXT,
  prateleira TEXT,
  gaveta TEXT,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE localizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY localizacoes_select ON localizacoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY localizacoes_insert ON localizacoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY localizacoes_update ON localizacoes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY localizacoes_delete ON localizacoes FOR DELETE USING (auth.uid() IS NOT NULL);

-- 4. PRODUTOS
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_comercial TEXT,
  principio_ativo TEXT,
  categoria_id UUID REFERENCES categorias(id),
  subcategoria TEXT,
  fabricante TEXT,
  codigo_barras TEXT,
  sku TEXT UNIQUE,
  registro_anvisa TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  quantidade_por_embalagem INTEGER DEFAULT 1,
  estoque_minimo INTEGER DEFAULT 0,
  estoque_maximo INTEGER,
  saldo_atual INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY produtos_select ON produtos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY produtos_insert ON produtos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY produtos_update ON produtos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY produtos_delete ON produtos FOR DELETE USING (auth.uid() IS NOT NULL);

-- 5. LOTES
CREATE TABLE IF NOT EXISTS lotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  numero_lote TEXT NOT NULL,
  data_fabricacao DATE,
  data_validade DATE NOT NULL,
  quantidade_recebida INTEGER NOT NULL DEFAULT 0,
  quantidade_disponivel INTEGER NOT NULL DEFAULT 0,
  custo_unitario DECIMAL(12,2),
  fornecedor_id UUID REFERENCES fornecedores(id),
  nota_fiscal TEXT,
  localizacao_id UUID REFERENCES localizacoes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT quantidade_disponivel_check CHECK (quantidade_disponivel >= 0)
);

ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lotes_select ON lotes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY lotes_insert ON lotes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY lotes_update ON lotes FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 6. COMPRAS
CREATE TABLE IF NOT EXISTS compras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id UUID REFERENCES fornecedores(id),
  numero_nota TEXT,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total DECIMAL(12,2),
  usuario_id UUID REFERENCES profiles(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY compras_select ON compras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY compras_insert ON compras FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. ITENS_COMPRA
CREATE TABLE IF NOT EXISTS itens_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  lote_id UUID REFERENCES lotes(id),
  quantidade INTEGER NOT NULL,
  valor_unitario DECIMAL(12,2),
  subtotal DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE itens_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_compra_select ON itens_compra FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY itens_compra_insert ON itens_compra FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. MOVIMENTACOES
CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  lote_id UUID REFERENCES lotes(id),
  tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN ('entrada','saida','ajuste','transferencia','perda','descarte')),
  quantidade INTEGER NOT NULL,
  usuario_id UUID REFERENCES profiles(id),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY movimentacoes_select ON movimentacoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY movimentacoes_insert ON movimentacoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- NUNCA deletar ou alterar movimentações (regra de negócio)

-- 9. INVENTARIOS
CREATE TABLE IF NOT EXISTS inventarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  lote_id UUID REFERENCES lotes(id),
  quantidade_sistema INTEGER NOT NULL,
  quantidade_fisica INTEGER NOT NULL,
  diferenca INTEGER NOT NULL,
  usuario_id UUID REFERENCES profiles(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventarios_select ON inventarios FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inventarios_insert ON inventarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 10. AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME,
  tipo_consulta TEXT,
  status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado','confirmado','cancelado','realizado','faltou')),
  observacao TEXT,
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agendamentos_select ON agendamentos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY agendamentos_insert ON agendamentos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY agendamentos_update ON agendamentos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY agendamentos_delete ON agendamentos FOR DELETE USING (auth.uid() IS NOT NULL);

-- 11. ALERTAS
CREATE TABLE IF NOT EXISTS alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('estoque_minimo','vencido','vencendo_30','vencendo_60','vencendo_90','lote_zerado','divergencia_inventario')),
  produto_id UUID REFERENCES produtos(id),
  lote_id UUID REFERENCES lotes(id),
  mensagem TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertas_select ON alertas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY alertas_insert ON alertas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY alertas_update ON alertas FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- TRIGGER: Atualizar saldo_atual em produtos
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_saldo_produto()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
  v_produto_id UUID;
BEGIN
  v_produto_id := COALESCE(NEW.produto_id, OLD.produto_id);

  UPDATE produtos SET saldo_atual = (
    SELECT COALESCE(SUM(quantidade_disponivel), 0)
    FROM lotes
    WHERE produto_id = v_produto_id
  ) WHERE id = v_produto_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_saldo ON lotes;
CREATE TRIGGER trg_atualizar_saldo
  AFTER INSERT OR UPDATE OR DELETE ON lotes
  FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_produto();

REVOKE EXECUTE ON FUNCTION atualizar_saldo_produto() FROM anon, public;

-- ============================================================
-- FUNÇÃO: Gerar alertas automáticos
-- ============================================================
CREATE OR REPLACE FUNCTION gerar_alertas_estoque()
RETURNS void
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  -- Estoque abaixo do mínimo
  INSERT INTO alertas (tipo, produto_id, mensagem)
  SELECT 'estoque_minimo', p.id,
    'Estoque abaixo do mínimo: ' || p.nome || ' (saldo: ' || p.saldo_atual || ', mínimo: ' || p.estoque_minimo || ')'
  FROM produtos p
  WHERE p.ativo AND p.estoque_minimo > 0 AND p.saldo_atual <= p.estoque_minimo
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.produto_id = p.id AND a.tipo = 'estoque_minimo' AND a.lido = false);

  -- Produtos vencidos
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencido', l.produto_id, l.id,
    'Lote vencido: ' || p.nome || ' - Lote ' || l.numero_lote || ' (vencido em ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0 AND l.data_validade < CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencido' AND a.lido = false);

  -- Vencendo em 30 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_30', l.produto_id, l.id,
    'Vence em 30 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_30' AND a.lido = false);

  -- Vencendo em 60 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_60', l.produto_id, l.id,
    'Vence em 60 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_60' AND a.lido = false);

  -- Vencendo em 90 dias
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'vencendo_90', l.produto_id, l.id,
    'Vence em 90 dias: ' || p.nome || ' - Lote ' || l.numero_lote || ' (validade: ' || l.data_validade || ')'
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel > 0
    AND l.data_validade BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days'
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'vencendo_90' AND a.lido = false);

  -- Lotes sem quantidade
  INSERT INTO alertas (tipo, produto_id, lote_id, mensagem)
  SELECT 'lote_zerado', l.produto_id, l.id,
    'Lote sem quantidade: ' || p.nome || ' - Lote ' || l.numero_lote
  FROM lotes l
  JOIN produtos p ON p.id = l.produto_id
  WHERE l.quantidade_disponivel = 0 AND l.quantidade_recebida > 0
    AND NOT EXISTS (SELECT 1 FROM alertas a WHERE a.lote_id = l.id AND a.tipo = 'lote_zerado' AND a.lido = false);
END;
$$ LANGUAGE plpgsql;