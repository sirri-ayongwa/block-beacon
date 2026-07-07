
-- Add 'admin' to app_role if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
END $$;

-- notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  image_path TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own notifications" ON public.notifications;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete own notifications" ON public.notifications;
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: auto-handoff alert on 50 upvotes
CREATE OR REPLACE FUNCTION public.tg_auto_handoff_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.upvote_count >= 50 AND (OLD.upvote_count IS NULL OR OLD.upvote_count < 50) AND NEW.handed_off_at IS NULL THEN
    INSERT INTO public.notifications (user_id, kind, issue_id, title, body)
    SELECT ur.user_id, 'auto_handoff_ready', NEW.id,
           'Issue crossed 50 upvotes',
           'A community issue "' || COALESCE(NEW.title, 'Untitled') || '" reached 50 upvotes and is ready for handoff.'
    FROM public.user_roles ur
    WHERE ur.role = 'moderator';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_handoff_threshold ON public.issues;
CREATE TRIGGER trg_auto_handoff_threshold
AFTER UPDATE OF upvote_count ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_handoff_threshold();

-- Trigger: notify upvoters on handoff
CREATE OR REPLACE FUNCTION public.tg_notify_voters_on_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  photo_path TEXT;
BEGIN
  IF NEW.handed_off_at IS NOT NULL AND OLD.handed_off_at IS NULL THEN
    SELECT path INTO photo_path FROM public.issue_photos WHERE issue_id = NEW.id ORDER BY created_at LIMIT 1;
    INSERT INTO public.notifications (user_id, kind, issue_id, title, body, image_path)
    SELECT iv.user_id, 'handoff', NEW.id,
           'Handed off to city hall',
           'The issue "' || COALESCE(NEW.title, 'Untitled') || '" you upvoted has been handed off to a verified moderator.',
           photo_path
    FROM public.issue_votes iv
    WHERE iv.issue_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_voters_on_handoff ON public.issues;
CREATE TRIGGER trg_notify_voters_on_handoff
AFTER UPDATE OF handed_off_at ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_voters_on_handoff();
