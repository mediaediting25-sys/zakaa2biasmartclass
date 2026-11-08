COMMENT ON COLUMN public.student_link_codes.expires_at IS 'DEPRECATED: validity now follows current enrollment; retained for compatibility';
CREATE OR REPLACE FUNCTION public.get_my_link_code(_regenerate boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _c text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'student') THEN RAISE EXCEPTION 'students only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.enrollments e JOIN public.courses c ON c.id=e.course_id WHERE e.student_id=auth.uid() AND c.status <> 'archived') THEN RAISE EXCEPTION 'active enrollment required'; END IF;
 SELECT code INTO _c FROM public.student_link_codes WHERE student_id=auth.uid() FOR UPDATE;
 IF _c IS NULL OR _regenerate THEN
  _c := upper(substr(md5(gen_random_uuid()::text),1,8));
  INSERT INTO public.student_link_codes(student_id,code,expires_at) VALUES(auth.uid(),_c,'infinity'::timestamptz) ON CONFLICT(student_id) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, created_at=now();
 END IF;
 RETURN _c;
END $$;
CREATE OR REPLACE FUNCTION public.redeem_link_code(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _sid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'parent') THEN RAISE EXCEPTION 'parents only'; END IF;
 SELECT student_id INTO _sid FROM public.student_link_codes WHERE code=upper(trim(_code)) FOR UPDATE;
 IF _sid IS NULL OR NOT EXISTS(SELECT 1 FROM public.enrollments e JOIN public.courses c ON c.id=e.course_id WHERE e.student_id=_sid AND c.status <> 'archived') THEN RAISE EXCEPTION 'invalid code'; END IF;
 INSERT INTO public.parent_links(parent_id,student_id,status) VALUES(auth.uid(),_sid,'approved') ON CONFLICT(parent_id,student_id) DO UPDATE SET status='approved';
 RETURN _sid;
END $$;
CREATE POLICY "linked parents read current code" ON public.student_link_codes FOR SELECT TO authenticated USING (public.is_parent_of(student_id) AND EXISTS(SELECT 1 FROM public.enrollments e JOIN public.courses c ON c.id=e.course_id WHERE e.student_id=student_link_codes.student_id AND c.status <> 'archived'));
CREATE OR REPLACE FUNCTION public.delete_rejected_question(_question_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _q public.questions%rowtype;
BEGIN
 SELECT * INTO _q FROM public.questions WHERE id=_question_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_course_teacher(_q.course_id) OR _q.status <> 'rejected' THEN RAISE EXCEPTION 'rejected teacher question required'; END IF;
 IF EXISTS(SELECT 1 FROM public.answers WHERE question_id=_question_id) THEN RAISE EXCEPTION 'question has student answers'; END IF;
 DELETE FROM public.questions WHERE id=_question_id AND status='rejected';
END $$;
REVOKE ALL ON FUNCTION public.get_my_link_code(boolean), public.redeem_link_code(text), public.delete_rejected_question(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_link_code(boolean), public.redeem_link_code(text), public.delete_rejected_question(uuid) TO authenticated;