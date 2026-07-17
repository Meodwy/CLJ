-- Migração: Assistente IA
-- Habilita pgvector se não existir
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TABELA: conhecimento_farma (RAG)
-- ============================================
CREATE TABLE IF NOT EXISTS conhecimento_farma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('bula', 'interacao', 'manipulacao', 'posologia', 'legislacao')),
  conteudo text NOT NULL,
  fonte text,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conhecimento_farma_embedding
  ON conhecimento_farma
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE conhecimento_farma ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conhecimento_farma' AND policyname = 'cfarma_select') THEN
    CREATE POLICY cfarma_select ON conhecimento_farma FOR SELECT TO authenticated, anon USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conhecimento_farma' AND policyname = 'cfarma_insert') THEN
    CREATE POLICY cfarma_insert ON conhecimento_farma FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'role' = 'administrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conhecimento_farma' AND policyname = 'cfarma_update') THEN
    CREATE POLICY cfarma_update ON conhecimento_farma FOR UPDATE TO authenticated USING (auth.jwt() ->> 'role' = 'administrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conhecimento_farma' AND policyname = 'cfarma_delete') THEN
    CREATE POLICY cfarma_delete ON conhecimento_farma FOR DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'administrador');
  END IF;
END $policies$;

-- Função de busca coseno
CREATE OR REPLACE FUNCTION match_conhecimento_farma(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  titulo text,
  categoria text,
  conteudo text,
  fonte text,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    cf.id,
    cf.titulo,
    cf.categoria,
    cf.conteudo,
    cf.fonte,
    1 - (cf.embedding <=> query_embedding) AS similarity
  FROM conhecimento_farma cf
  WHERE 1 - (cf.embedding <=> query_embedding) > match_threshold
  ORDER BY cf.embedding <=> query_embedding
  LIMIT match_count;
END;
$func$;

REVOKE EXECUTE ON FUNCTION match_conhecimento_farma FROM anon;
GRANT EXECUTE ON FUNCTION match_conhecimento_farma TO authenticated, service_role;

-- ============================================
-- CONFIGURAÇÕES: gemini_api_key
-- ============================================
-- Garante que a tabela existe (caso seed.js não tenha rodado)
CREATE TABLE IF NOT EXISTS configuracoes (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Garante RLS
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

DO $config$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes' AND policyname = 'config_admin_select') THEN
    CREATE POLICY config_admin_select ON configuracoes FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' = 'administrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes' AND policyname = 'config_admin_insert') THEN
    CREATE POLICY config_admin_insert ON configuracoes FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'role' = 'administrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes' AND policyname = 'config_admin_update') THEN
    CREATE POLICY config_admin_update ON configuracoes FOR UPDATE TO authenticated USING (auth.jwt() ->> 'role' = 'administrador') WITH CHECK (auth.jwt() ->> 'role' = 'administrador');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes' AND policyname = 'config_admin_delete') THEN
    CREATE POLICY config_admin_delete ON configuracoes FOR DELETE TO authenticated USING (auth.jwt() ->> 'role' = 'administrador');
  END IF;
END $config$;

GRANT ALL ON configuracoes TO anon, authenticated, service_role;
