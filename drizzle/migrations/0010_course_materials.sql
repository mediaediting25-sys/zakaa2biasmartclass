CREATE TABLE public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('lesson','presentation','questions')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  link_url text CHECK (link_url IS NULL OR link_url ~* '^https://'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_materials_course_idx ON public.course_materials(course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_materials TO authenticated;
GRANT ALL ON public.course_materials TO service_role;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers manage materials" ON public.course_materials FOR ALL TO authenticated
  USING (public.is_course_teacher(course_id)) WITH CHECK (public.is_course_teacher(course_id));
CREATE POLICY "students read published materials" ON public.course_materials FOR SELECT TO authenticated
  USING (status = 'published' AND public.is_enrolled(course_id) AND public.course_is_published(course_id));
CREATE POLICY "blocked accounts denied" ON public.course_materials AS RESTRICTIVE TO authenticated USING (NOT public.is_account_blocked());

CREATE POLICY "teacher write materials" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='course-materials' AND public.is_course_teacher(((storage.foldername(name))[1])::uuid));
CREATE POLICY "teacher delete materials" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='course-materials' AND public.is_course_teacher(((storage.foldername(name))[1])::uuid));
CREATE POLICY "read materials files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='course-materials' AND (public.is_course_teacher(((storage.foldername(name))[1])::uuid)
    OR EXISTS (SELECT 1 FROM public.course_materials m WHERE m.storage_path = storage.objects.name AND m.status='published'
      AND public.is_enrolled(m.course_id) AND public.course_is_published(m.course_id))));