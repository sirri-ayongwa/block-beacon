
ALTER TABLE public.moderator_profiles
  ADD COLUMN IF NOT EXISTS proof_photo_path text,
  ADD COLUMN IF NOT EXISTS proof_kind text,
  ADD COLUMN IF NOT EXISTS ai_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_moderator_ai_verified()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ai_verified = true AND (OLD.ai_verified IS DISTINCT FROM true) THEN
    NEW.verified := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moderator_ai_verified ON public.moderator_profiles;
CREATE TRIGGER moderator_ai_verified
BEFORE UPDATE ON public.moderator_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_moderator_ai_verified();

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS photo_phash text;
CREATE INDEX IF NOT EXISTS issues_photo_phash_idx ON public.issues (photo_phash) WHERE photo_phash IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_last_sent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('blockbeacon-weekly-digest');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'blockbeacon-weekly-digest',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--fdcf214a-7ce7-40dc-b602-6d9f05e30266.lovable.app/api/public/weekly-digest',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_WGK98F-J5fub3ROhwIftHQ_WGFer3bK"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
