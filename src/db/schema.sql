-- ============================================================
-- Chill Digital Dashboard — Schema completo
-- Ejecutar en: Supabase > SQL Editor > New query
-- ============================================================


-- ============================================================
-- TABLAS
-- ============================================================

-- 1. clients
CREATE TABLE IF NOT EXISTS public.clients (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,
  slug             text          NOT NULL UNIQUE,
  meta_account_id  text          NOT NULL,
  meta_access_token text         NOT NULL,
  active           boolean       NOT NULL DEFAULT true,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS 'Cuentas publicitarias de clientes de la agencia';
COMMENT ON COLUMN public.clients.meta_account_id IS 'ID de cuenta de Meta Ads (act_XXXXXXXXXX)';
COMMENT ON COLUMN public.clients.meta_access_token IS 'Token de acceso a Meta Marketing API del cliente';


-- 2. client_thresholds
CREATE TABLE IF NOT EXISTS public.client_thresholds (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  roas_min    numeric(10,2) NOT NULL,
  cpa_max     numeric(10,2) NOT NULL,
  sales_min   integer       NOT NULL,
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_thresholds IS 'Umbrales de performance por cliente para alertas y benchmarks';


-- 3. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        text        NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfil de usuarios del dashboard (equipo Chill Digital)';


-- 4. client_user_access
CREATE TABLE IF NOT EXISTS public.client_user_access (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid  NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (client_id, user_id)
);

COMMENT ON TABLE public.client_user_access IS 'Asignación de usuarios a clientes — controla qué operadores ven qué cuentas';


-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clients_slug         ON public.clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_active        ON public.clients(active);
CREATE INDEX IF NOT EXISTS idx_thresholds_client_id  ON public.client_thresholds(client_id);
CREATE INDEX IF NOT EXISTS idx_access_client_id      ON public.client_user_access(client_id);
CREATE INDEX IF NOT EXISTS idx_access_user_id        ON public.client_user_access(user_id);


-- ============================================================
-- TRIGGER: crear profile automáticamente al registrar usuario
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- TRIGGER: updated_at automático en client_thresholds
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_thresholds_updated_at ON public.client_thresholds;

CREATE TRIGGER set_client_thresholds_updated_at
  BEFORE UPDATE ON public.client_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_thresholds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_user_access ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLICIES — clients
-- ============================================================

-- Admins ven todos los clientes; operadores solo los asignados
CREATE POLICY "clients_select"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_user_access
      WHERE client_id = clients.id AND user_id = auth.uid()
    )
  );

-- Solo admins pueden crear, editar y eliminar clientes
CREATE POLICY "clients_insert"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "clients_update"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "clients_delete"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================================
-- POLICIES — client_thresholds
-- ============================================================

-- Misma lógica de visibilidad que clients
CREATE POLICY "thresholds_select"
  ON public.client_thresholds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_user_access
      WHERE client_id = client_thresholds.client_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "thresholds_insert"
  ON public.client_thresholds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "thresholds_update"
  ON public.client_thresholds
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ============================================================
-- POLICIES — profiles
-- ============================================================

-- Cada usuario ve su propio perfil; admins ven todos
CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Cada usuario puede actualizar solo su propio perfil
CREATE POLICY "profiles_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- No permite que el usuario se cambie el role a sí mismo
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );


-- ============================================================
-- POLICIES — client_user_access
-- ============================================================

-- Usuarios ven solo sus propias asignaciones; admins ven todas
CREATE POLICY "access_select"
  ON public.client_user_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins gestionan asignaciones
CREATE POLICY "access_insert"
  ON public.client_user_access
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "access_delete"
  ON public.client_user_access
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
