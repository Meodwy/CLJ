-- Habilita DELETE no inventario (admin)
CREATE POLICY inventarios_delete ON inventarios FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrador'
    )
  );
