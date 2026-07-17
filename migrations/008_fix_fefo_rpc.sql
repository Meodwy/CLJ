-- FEFO consumption RPC (atomic transaction)
CREATE OR REPLACE FUNCTION public.consumir_fefo(
  p_produto_id UUID,
  p_quantidade INTEGER,
  p_usuario_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
SET search_path = public
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_lote RECORD;
  v_resto INTEGER;
  v_consumido INTEGER;
  v_result JSONB := '[]'::JSONB;
  v_total_disp INTEGER;
BEGIN
  -- Check auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'consumir_fefo: nao autenticado';
  END IF;

  -- Check total available
  SELECT COALESCE(SUM(quantidade_disponivel), 0) INTO v_total_disp
  FROM lotes
  WHERE produto_id = p_produto_id AND quantidade_disponivel > 0;

  IF v_total_disp < p_quantidade THEN
    RAISE EXCEPTION 'consumir_fefo: estoque insuficiente (disponivel: %, solicitado: %)', v_total_disp, p_quantidade;
  END IF;

  v_resto := p_quantidade;

  FOR v_lote IN
    SELECT id, quantidade_disponivel, numero_lote
    FROM lotes
    WHERE produto_id = p_produto_id AND quantidade_disponivel > 0
    ORDER BY data_validade ASC NULLS LAST
    FOR UPDATE  -- Lock rows!
  LOOP
    EXIT WHEN v_resto <= 0;

    v_consumido := LEAST(v_resto, v_lote.quantidade_disponivel);

    -- Update lote
    UPDATE lotes SET quantidade_disponivel = quantidade_disponivel - v_consumido
    WHERE id = v_lote.id;

    -- Insert movimentacao
    INSERT INTO movimentacoes (produto_id, lote_id, tipo_movimentacao, quantidade, usuario_id, observacao)
    VALUES (p_produto_id, v_lote.id, 'saida', v_consumido, p_usuario_id,
            COALESCE(p_observacao, 'Consumo FEFO - Lote ' || v_lote.numero_lote));

    v_result := v_result || JSONB_BUILD_OBJECT(
      'loteId', v_lote.id,
      'quantidade', v_consumido,
      'numero_lote', v_lote.numero_lote
    );

    v_resto := v_resto - v_consumido;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'success', true,
    'lotesConsumidos', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_fefo(UUID, INTEGER, UUID, TEXT) FROM anon, public;
