CREATE OR REPLACE FUNCTION public.teacher_access_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT auth.uid() IS NOT NULL AND (
  NOT public.has_role(auth.uid(),'teacher')
  OR public.is_platform_owner()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.created_at > now()-interval '30 days')
  OR EXISTS(SELECT 1 FROM public.teacher_access_periods t WHERE t.teacher_id=auth.uid() AND now() BETWEEN t.starts_at AND t.ends_at))
$$;
REVOKE ALL ON FUNCTION public.teacher_access_active() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.teacher_access_active() TO authenticated;
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['courses','lessons','objectives','content_items','questions','activities','documents','course_materials','course_plans','lesson_presentations','ai_jobs'] LOOP
  EXECUTE format('CREATE POLICY "active teacher access insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.teacher_access_active())', t);
  EXECUTE format('CREATE POLICY "active teacher access update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.teacher_access_active()) WITH CHECK (public.teacher_access_active())', t);
END LOOP; END $$;