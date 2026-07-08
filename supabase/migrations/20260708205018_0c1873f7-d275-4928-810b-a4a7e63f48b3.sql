
DROP POLICY IF EXISTS "mod proofs owner upload" ON storage.objects;
CREATE POLICY "mod proofs owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'moderator-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "mod proofs owner read" ON storage.objects;
CREATE POLICY "mod proofs owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'moderator-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
