-- RESIDENTS
CREATE TABLE public.residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  start_year integer NOT NULL DEFAULT 2026,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.residents TO anon, authenticated;
GRANT ALL ON public.residents TO service_role;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "residents_public_read" ON public.residents FOR SELECT TO anon, authenticated USING (true);

-- CONTRIBUTIONS
CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  resident_name text NOT NULL,
  sent_date date NOT NULL DEFAULT CURRENT_DATE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2022),
  method text NOT NULL CHECK (method IN ('tunai','transfer')),
  purpose text NOT NULL CHECK (purpose IN ('iuran','sumbangan')),
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, resident_id, resident_name, sent_date, period_month, period_year, method, purpose, note, status, admin_note, created_at, updated_at)
  ON public.contributions TO anon, authenticated;
GRANT INSERT (resident_id, resident_name, sent_date, period_month, period_year, method, purpose, amount, note)
  ON public.contributions TO anon, authenticated;
GRANT ALL ON public.contributions TO service_role;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrib_public_read" ON public.contributions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "contrib_public_insert" ON public.contributions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date date NOT NULL DEFAULT CURRENT_DATE,
  purpose text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expenses TO anon, authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_public_read" ON public.expenses FOR SELECT TO anon, authenticated USING (true);

-- WAIVERS (hutang dihapus / dianggap lunas oleh pusat)
CREATE TABLE public.waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resident_id, period_month, period_year)
);
GRANT SELECT ON public.waivers TO anon, authenticated;
GRANT ALL ON public.waivers TO service_role;
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waivers_public_read" ON public.waivers FOR SELECT TO anon, authenticated USING (true);

-- CHANGE LOG (transparansi)
CREATE TABLE public.change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_label text,
  action text NOT NULL,
  description text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.change_logs TO anon, authenticated;
GRANT ALL ON public.change_logs TO service_role;
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_public_read" ON public.change_logs FOR SELECT TO anon, authenticated USING (true);

-- PUBLIC CONFIG (saldo awal)
CREATE TABLE public.app_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  opening_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_public_read" ON public.app_config FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_config (id, opening_balance, opening_note) VALUES (1, 0, 'Saldo kas sebelum aplikasi digunakan');

-- ADMIN SETTINGS (rahasia, tanpa akses publik)
CREATE TABLE public.admin_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password text NOT NULL DEFAULT '8055DRU7590',
  default_password text NOT NULL DEFAULT '8055DRU7590',
  reset_code text NOT NULL DEFAULT 'GH1GH41S',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_settings (id) VALUES (1);

-- ADMIN SESSIONS
CREATE TABLE public.admin_sessions (
  token text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '12 hours'
);
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_residents_touch BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_contrib_touch BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_expenses_touch BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Ringkasan kas (publik, tanpa membocorkan nominal per warga)
CREATE OR REPLACE FUNCTION public.kas_summary(p_month integer DEFAULT NULL, p_year integer DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'opening_balance', (SELECT opening_balance FROM public.app_config WHERE id = 1),
    'total_masuk_all', COALESCE((SELECT SUM(amount) FROM public.contributions WHERE status = 'approved'), 0),
    'total_keluar_all', COALESCE((SELECT SUM(amount) FROM public.expenses), 0),
    'saldo', (SELECT opening_balance FROM public.app_config WHERE id = 1)
             + COALESCE((SELECT SUM(amount) FROM public.contributions WHERE status = 'approved'), 0)
             - COALESCE((SELECT SUM(amount) FROM public.expenses), 0),
    'masuk_periode', COALESCE((
      SELECT SUM(amount) FROM public.contributions
      WHERE status = 'approved'
        AND (p_month IS NULL OR EXTRACT(MONTH FROM sent_date) = p_month)
        AND (p_year IS NULL OR EXTRACT(YEAR FROM sent_date) = p_year)
    ), 0),
    'keluar_periode', COALESCE((
      SELECT SUM(amount) FROM public.expenses
      WHERE (p_month IS NULL OR EXTRACT(MONTH FROM spend_date) = p_month)
        AND (p_year IS NULL OR EXTRACT(YEAR FROM spend_date) = p_year)
    ), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.kas_summary(integer, integer) TO anon, authenticated, service_role;

-- Realtime
ALTER TABLE public.residents REPLICA IDENTITY FULL;
ALTER TABLE public.contributions REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.waivers REPLICA IDENTITY FULL;
ALTER TABLE public.change_logs REPLICA IDENTITY FULL;
ALTER TABLE public.app_config REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.residents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.change_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;