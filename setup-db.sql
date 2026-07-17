-- Tabela de perfis (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'atendente'
    CHECK (role IN ('administrador', 'farmaceutico', 'atendente', 'manipulador', 'estoquista', 'financeiro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usuário só edita o próprio perfil
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (id = auth.uid());

-- INSERT via trigger ou admin
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger: auto-cria perfil ao criar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'atendente')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;