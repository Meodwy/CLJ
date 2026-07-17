-- ============================================================
-- CLJ Clinica — Despesas Recorrentes
-- Add suporte a despesas mensais que se repetem automaticamente
-- ============================================================

ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31));

-- Grant REST API access
GRANT ALL ON despesas TO authenticated, service_role;
