CREATE TABLE public.course_plans (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  sessions_per_period integer NOT NULL DEFAULT 2,
  period text NOT NULL DEFAULT 'week',
  review_per_unit boolean NOT NULL DEFAULT true,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_plans TO authenticated;
GRANT ALL ON public.course_plans TO service_role;
ALTER TABLE public.course_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher manages plan" ON public.course_plans FOR ALL TO authenticated
  USING (public.is_course_teacher(course_id)) WITH CHECK (public.is_course_teacher(course_id));
CREATE POLICY "enrolled read plan" ON public.course_plans FOR SELECT TO authenticated
  USING (public.can_read_course_content(course_id));
CREATE TRIGGER course_plans_touch BEFORE UPDATE ON public.course_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.lesson_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'ar',
  title text NOT NULL,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_presentations TO authenticated;
GRANT ALL ON public.lesson_presentations TO service_role;
ALTER TABLE public.lesson_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher manages presentations" ON public.lesson_presentations FOR ALL TO authenticated
  USING (public.is_course_teacher(course_id)) WITH CHECK (public.is_course_teacher(course_id));
CREATE POLICY "enrolled read presentations" ON public.lesson_presentations FOR SELECT TO authenticated
  USING (public.can_read_course_content(course_id));