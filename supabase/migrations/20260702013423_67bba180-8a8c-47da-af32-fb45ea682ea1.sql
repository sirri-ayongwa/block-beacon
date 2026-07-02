
REVOKE EXECUTE ON FUNCTION public.sync_issue_upvote_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies for issue-photos bucket
CREATE POLICY "authenticated can view issue photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'issue-photos');

CREATE POLICY "authenticated can upload own issue photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'issue-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner can delete issue photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'issue-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
