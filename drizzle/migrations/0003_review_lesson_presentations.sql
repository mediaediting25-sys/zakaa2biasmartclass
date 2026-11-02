ALTER TABLE public.lesson_presentations ADD COLUMN status public.content_status NOT NULL DEFAULT 'draft';
DROP POLICY "enrolled read presentations" ON public.lesson_presentations;
CREATE POLICY "enrolled read published presentations" ON public.lesson_presentations FOR SELECT TO authenticated USING (status = 'published' AND public.can_read_course_content(course_id));
ALTER TABLE public.course_plans ADD CONSTRAINT course_plans_dates CHECK (end_date >= start_date), ADD CONSTRAINT course_plans_frequency CHECK (sessions_per_period BETWEEN 1 AND 30 AND period IN ('week','month'));
ALTER TABLE public.lesson_presentations ADD CONSTRAINT lesson_presentations_language CHECK (language IN ('ar','en'));