ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_kasbon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kasbon_resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kasbon_resident_name text;

CREATE INDEX IF NOT EXISTS expenses_kasbon_resident_idx ON public.expenses (kasbon_resident_id);