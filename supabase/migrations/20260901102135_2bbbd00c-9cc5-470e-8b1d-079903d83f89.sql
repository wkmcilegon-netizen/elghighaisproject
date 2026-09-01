CREATE OR REPLACE FUNCTION public.kasbon_summary()
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(t), '[]'::json) FROM (
    SELECT
      e.kasbon_resident_id AS resident_id,
      MAX(e.kasbon_resident_name) AS resident_name,
      SUM(e.amount) AS total,
      COALESCE((
        SELECT SUM(c.amount) FROM public.contributions c
        WHERE c.resident_id = e.kasbon_resident_id
          AND c.purpose = 'kasbon'
          AND c.status = 'approved'
      ), 0) AS dibayar
    FROM public.expenses e
    WHERE e.is_kasbon = true AND e.kasbon_resident_id IS NOT NULL
    GROUP BY e.kasbon_resident_id
  ) t;
$$;