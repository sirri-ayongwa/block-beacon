
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS home_lat double precision,
  ADD COLUMN IF NOT EXISTS home_lng double precision,
  ADD COLUMN IF NOT EXISTS home_zoom integer DEFAULT 13,
  ADD COLUMN IF NOT EXISTS default_anonymous boolean NOT NULL DEFAULT false;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.issue_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_photos_issue_idx ON public.issue_photos(issue_id);

GRANT SELECT ON public.issue_photos TO anon, authenticated;
GRANT INSERT, DELETE ON public.issue_photos TO authenticated;
GRANT ALL ON public.issue_photos TO service_role;

ALTER TABLE public.issue_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos readable by all" ON public.issue_photos;
CREATE POLICY "photos readable by all" ON public.issue_photos FOR SELECT USING (true);
DROP POLICY IF EXISTS "reporter can add photos" ON public.issue_photos;
CREATE POLICY "reporter can add photos" ON public.issue_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_id AND i.reporter_id = auth.uid()));
DROP POLICY IF EXISTS "reporter can remove photos" ON public.issue_photos;
CREATE POLICY "reporter can remove photos" ON public.issue_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_id AND i.reporter_id = auth.uid()));

INSERT INTO public.issue_photos (issue_id, path, created_at)
SELECT id, photo_path, created_at FROM public.issues
WHERE photo_path IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.issue_photos p WHERE p.issue_id = issues.id AND p.path = issues.photo_path);

CREATE TABLE IF NOT EXISTS public.issue_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  status public.issue_status NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_status_events_issue_idx ON public.issue_status_events(issue_id, created_at);

GRANT SELECT ON public.issue_status_events TO anon, authenticated;
GRANT INSERT ON public.issue_status_events TO authenticated;
GRANT ALL ON public.issue_status_events TO service_role;

ALTER TABLE public.issue_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status events readable by all" ON public.issue_status_events;
CREATE POLICY "status events readable by all" ON public.issue_status_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "reporter can log status" ON public.issue_status_events;
CREATE POLICY "reporter can log status" ON public.issue_status_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_id AND i.reporter_id = auth.uid()));

INSERT INTO public.issue_status_events (issue_id, status, created_at, created_by)
SELECT id, 'open'::public.issue_status, created_at, reporter_id
FROM public.issues i
WHERE NOT EXISTS (SELECT 1 FROM public.issue_status_events e WHERE e.issue_id = i.id);

CREATE OR REPLACE FUNCTION public.tg_record_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.issue_status_events(issue_id, status, created_by)
    VALUES (NEW.id, NEW.status, NEW.reporter_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.issue_status_events(issue_id, status, created_by)
    VALUES (NEW.id, NEW.status, auth.uid());
    IF NEW.status = 'acknowledged' AND NEW.acknowledged_at IS NULL THEN
      NEW.acknowledged_at := now();
    END IF;
    IF NEW.status = 'fixed' AND NEW.fixed_at IS NULL THEN
      NEW.fixed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issues_status_insert ON public.issues;
CREATE TRIGGER trg_issues_status_insert
AFTER INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_record_status_change();

DROP TRIGGER IF EXISTS trg_issues_status_update ON public.issues;
CREATE TRIGGER trg_issues_status_update
BEFORE UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_record_status_change();

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_status_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_photos; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
