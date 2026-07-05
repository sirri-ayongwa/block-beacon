
-- Roles
CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO anon, authenticated;
GRANT INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "user can claim moderator" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'moderator');

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Moderator profile
CREATE TABLE public.moderator_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization text NOT NULL,
  gov_email text NOT NULL,
  community text NOT NULL,
  proof_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moderator_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.moderator_profiles TO authenticated;
GRANT ALL ON public.moderator_profiles TO service_role;
ALTER TABLE public.moderator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mod profiles readable" ON public.moderator_profiles FOR SELECT USING (true);
CREATE POLICY "own mod profile insert" ON public.moderator_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "own mod profile update" ON public.moderator_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER moderator_profiles_updated
  BEFORE UPDATE ON public.moderator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-verify from gov-style email domain on insert/update
CREATE OR REPLACE FUNCTION public.autoverify_moderator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d text;
BEGIN
  d := lower(split_part(NEW.gov_email, '@', 2));
  IF d ~ '(^|\.)gov($|\.)' OR d ~ '(^|\.)gouv($|\.)' OR d ~ '\.gov\.[a-z]{2,}$' OR d ~ '\.gouv\.[a-z]{2,}$' OR d ~ '\.gc\.ca$' OR d ~ '\.mil$' THEN
    NEW.verified := true;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER moderator_autoverify
  BEFORE INSERT OR UPDATE ON public.moderator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.autoverify_moderator();

-- Issues: handoff + moderator update access
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS handed_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS handed_off_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_note text;

CREATE POLICY "moderators can update any issue" ON public.issues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators can log status" ON public.issue_status_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));

-- Comments
CREATE TABLE public.issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  is_moderator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.issue_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.issue_comments TO authenticated;
GRANT ALL ON public.issue_comments TO service_role;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.issue_comments FOR SELECT USING (true);
CREATE POLICY "auth posts comment" ON public.issue_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "author deletes comment" ON public.issue_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Chat rooms + messages
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable live" ON public.chat_rooms FOR SELECT TO authenticated
  USING (expires_at > now());
CREATE POLICY "auth create room" ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator updates room" ON public.chat_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator deletes room" ON public.chat_rooms FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs readable live room" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.expires_at > now()));
CREATE POLICY "auth posts msg" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS(SELECT 1 FROM public.chat_rooms r WHERE r.id = room_id AND r.expires_at > now()));
CREATE POLICY "author deletes msg" ON public.chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Profile prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_subscribed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_language text;

-- Leaderboard helper view
CREATE OR REPLACE VIEW public.reporter_leaderboard AS
  SELECT
    p.id,
    COALESCE(p.display_name, 'A neighbor') AS display_name,
    p.country,
    COUNT(i.id)::int AS report_count,
    COALESCE(SUM(i.upvote_count), 0)::int AS total_upvotes,
    COUNT(i.id) FILTER (WHERE i.status = 'fixed')::int AS fixed_count
  FROM public.profiles p
  LEFT JOIN public.issues i ON i.reporter_id = p.id AND i.is_anonymous = false
  GROUP BY p.id;
GRANT SELECT ON public.reporter_leaderboard TO anon, authenticated;
