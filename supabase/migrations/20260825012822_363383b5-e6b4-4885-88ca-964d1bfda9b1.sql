CREATE TABLE public.kegiatan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  year integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kegiatan TO anon, authenticated;
GRANT ALL ON public.kegiatan TO service_role;
ALTER TABLE public.kegiatan ENABLE ROW LEVEL SECURITY;
CREATE POLICY kegiatan_public_read ON public.kegiatan FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER trg_kegiatan_touch BEFORE UPDATE ON public.kegiatan FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.kegiatan_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id uuid NOT NULL REFERENCES public.kegiatan(id) ON DELETE CASCADE,
  path text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kegiatan_media TO anon, authenticated;
GRANT ALL ON public.kegiatan_media TO service_role;
ALTER TABLE public.kegiatan_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY kegiatan_media_public_read ON public.kegiatan_media FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX idx_kegiatan_media_kegiatan ON public.kegiatan_media(kegiatan_id);