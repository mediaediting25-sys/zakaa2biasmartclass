DROP POLICY IF EXISTS teacher_photo_read ON storage.objects;
CREATE POLICY teacher_photo_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'teacher-avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);