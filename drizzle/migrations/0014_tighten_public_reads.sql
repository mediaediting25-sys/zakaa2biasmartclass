DROP POLICY IF EXISTS "Public announcement reads" ON public.platform_settings;
CREATE POLICY "Public announcement reads" ON public.platform_settings FOR SELECT TO anon, authenticated USING (id = 'public');
DROP POLICY IF EXISTS "Public plan reads" ON public.platform_plan_overrides;
CREATE POLICY "Public plan reads" ON public.platform_plan_overrides FOR SELECT TO anon, authenticated USING (id IN ('starter','pro','elite','center'));
DROP POLICY IF EXISTS teacher_photo_read ON storage.objects;
CREATE POLICY teacher_photo_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'teacher-avatars' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.teacher_listings t WHERE t.is_listed AND t.photo_path = objects.name AND (storage.foldername(objects.name))[1] = t.teacher_id::text)
  ));