
-- Enums
CREATE TYPE public.issue_category AS ENUM (
  'broken_streetlight','litter','pothole','unsafe_intersection','graffiti','damaged_sidewalk','abandoned_item','water_leak','other'
);
CREATE TYPE public.issue_status AS ENUM ('open','acknowledged','fixed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Issues
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.issue_category NOT NULL DEFAULT 'other',
  status public.issue_status NOT NULL DEFAULT 'open',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  photo_path TEXT,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX issues_created_at_idx ON public.issues (created_at DESC);
CREATE INDEX issues_location_idx ON public.issues (lat, lng);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT SELECT ON public.issues TO anon;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues readable by all" ON public.issues FOR SELECT USING (true);
CREATE POLICY "authenticated can insert issues" ON public.issues FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reporter can update own issue" ON public.issues FOR UPDATE TO authenticated USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reporter can delete own issue" ON public.issues FOR DELETE TO authenticated USING (auth.uid() = reporter_id);

-- Votes
CREATE TABLE public.issue_votes (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.issue_votes TO authenticated;
GRANT SELECT ON public.issue_votes TO anon;
GRANT ALL ON public.issue_votes TO service_role;
ALTER TABLE public.issue_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable by all" ON public.issue_votes FOR SELECT USING (true);
CREATE POLICY "user can add own vote" ON public.issue_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can remove own vote" ON public.issue_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to keep upvote_count in sync
CREATE OR REPLACE FUNCTION public.sync_issue_upvote_count() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.issues SET upvote_count = upvote_count + 1 WHERE id = NEW.issue_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.issues SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.issue_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_issue_votes_count
AFTER INSERT OR DELETE ON public.issue_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_issue_upvote_count();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_issues_updated_at BEFORE UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_votes;
