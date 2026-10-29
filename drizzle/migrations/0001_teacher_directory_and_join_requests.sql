CREATE TABLE public.teacher_listings (
  teacher_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  bio text,
  subjects text[] NOT NULL DEFAULT '{}',
  grade_levels text,
  is_listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_listings TO authenticated;
GRANT ALL ON public.teacher_listings TO service_role;
ALTER TABLE public.teacher_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listed teachers are public" ON public.teacher_listings FOR SELECT TO anon, authenticated USING (is_listed OR teacher_id = auth.uid());
CREATE POLICY "Teachers manage own listing" ON public.teacher_listings FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid() AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE TRIGGER teacher_listings_touch BEFORE UPDATE ON public.teacher_listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  student_name text,
  subject text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Involved users read requests" ON public.join_requests FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR student_id = auth.uid() OR requested_by = auth.uid());
CREATE POLICY "Students or parents create requests" ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'pending'
    AND (student_id = auth.uid() OR public.is_parent_of(student_id))
    AND EXISTS (SELECT 1 FROM public.teacher_listings t WHERE t.teacher_id = join_requests.teacher_id AND t.is_listed));

CREATE OR REPLACE FUNCTION public.join_request_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT coalesce(full_name, email) INTO NEW.student_name FROM public.profiles WHERE id = NEW.student_id;
  NEW.status := 'pending'; NEW.course_id := NULL; NEW.decided_at := NULL;
  IF EXISTS (SELECT 1 FROM public.join_requests WHERE teacher_id = NEW.teacher_id AND student_id = NEW.student_id AND status = 'pending') THEN
    RAISE EXCEPTION 'يوجد طلب قيد المراجعة لهذا المدرس بالفعل';
  END IF;
  INSERT INTO public.notifications(user_id, kind, title, body, link)
  VALUES (NEW.teacher_id, 'join_request', 'طلب انضمام جديد', coalesce(NEW.student_name,'طالب') || coalesce(' — ' || NEW.subject, ''), '/teacher');
  RETURN NEW;
END $$;
CREATE TRIGGER join_requests_before_insert BEFORE INSERT ON public.join_requests FOR EACH ROW EXECUTE FUNCTION public.join_request_before_insert();

CREATE OR REPLACE FUNCTION public.decide_join_request(_request_id uuid, _approve boolean, _course_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.join_requests;
BEGIN
  SELECT * INTO r FROM public.join_requests WHERE id = _request_id;
  IF r.id IS NULL OR r.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'تم البت في هذا الطلب'; END IF;
  IF _approve THEN
    IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = _course_id AND teacher_id = auth.uid()) THEN
      RAISE EXCEPTION 'اختر مقررًا من مقرراتك';
    END IF;
    INSERT INTO public.enrollments(course_id, student_id)
      SELECT _course_id, r.student_id
      WHERE NOT EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = _course_id AND student_id = r.student_id);
    UPDATE public.join_requests SET status = 'approved', course_id = _course_id, decided_at = now() WHERE id = r.id;
  ELSE
    UPDATE public.join_requests SET status = 'rejected', decided_at = now() WHERE id = r.id;
  END IF;
  INSERT INTO public.notifications(user_id, kind, title, body, link)
  SELECT DISTINCT u, 'join_request', CASE WHEN _approve THEN 'تم قبول طلب الانضمام' ELSE 'تم رفض طلب الانضمام' END, r.subject, '/teachers'
  FROM unnest(ARRAY[r.student_id, r.requested_by]) AS u;
END $$;
REVOKE EXECUTE ON FUNCTION public.decide_join_request(uuid, boolean, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.decide_join_request(uuid, boolean, uuid) TO authenticated;