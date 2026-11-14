CREATE TABLE public.teacher_access_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 plan_id text NOT NULL CHECK(plan_id IN ('starter','pro','elite','center')), kind text NOT NULL CHECK(kind IN ('complimentary','manual_subscription')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, granted_by uuid NOT NULL REFERENCES public.profiles(id), reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000), created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at>starts_at)
);
GRANT SELECT ON public.teacher_access_periods TO authenticated;
GRANT ALL ON public.teacher_access_periods TO service_role;
ALTER TABLE public.teacher_access_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher reads own periods or subscription editor" ON public.teacher_access_periods FOR SELECT TO authenticated USING(NOT public.is_account_blocked() AND (teacher_id=auth.uid() OR public.has_admin_permission('subscriptions')));
CREATE INDEX teacher_access_periods_teacher_end ON public.teacher_access_periods(teacher_id,ends_at DESC);
CREATE TABLE public.teacher_renewal_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 plan_id text NOT NULL CHECK(plan_id IN ('starter','pro','elite','center')), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid REFERENCES public.profiles(id), access_period_id uuid REFERENCES public.teacher_access_periods(id)
);
GRANT SELECT ON public.teacher_renewal_requests TO authenticated;
GRANT ALL ON public.teacher_renewal_requests TO service_role;
ALTER TABLE public.teacher_renewal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher reads own requests or subscription editor" ON public.teacher_renewal_requests FOR SELECT TO authenticated USING(NOT public.is_account_blocked() AND (teacher_id=auth.uid() OR public.has_admin_permission('subscriptions')));
CREATE UNIQUE INDEX teacher_one_pending_renewal ON public.teacher_renewal_requests(teacher_id) WHERE status='pending';
CREATE FUNCTION public.admin_subscription_teachers() RETURNS TABLE(user_id uuid,full_name text,email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email FROM public.profiles p WHERE public.has_role(p.id,'teacher') ORDER BY p.full_name;
END $$;
CREATE FUNCTION public.grant_teacher_access(_teacher_id uuid,_plan_id text,_days integer,_kind text,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE start_time timestamptz; new_id uuid;
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _days IS NULL OR _days<1 OR _days>3650 OR _plan_id IS NULL OR _plan_id NOT IN ('starter','pro','elite','center') OR _kind IS NULL OR _kind NOT IN ('complimentary','manual_subscription') OR _reason IS NULL OR length(_reason)>1000 THEN RAISE EXCEPTION 'Invalid access period'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_teacher_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_teacher_id,'teacher') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_teacher_id) THEN RAISE EXCEPTION 'Teacher account required'; END IF;
 SELECT greatest(now(),coalesce(max(ends_at),now())) INTO start_time FROM public.teacher_access_periods WHERE teacher_id=_teacher_id;
 INSERT INTO public.teacher_access_periods(teacher_id,plan_id,kind,starts_at,ends_at,granted_by,reason) VALUES(_teacher_id,_plan_id,_kind,start_time,start_time+make_interval(days=>_days),auth.uid(),_reason) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE FUNCTION public.request_teacher_renewal(_plan_id text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT public.has_role(auth.uid(),'teacher') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _plan_id IS NULL OR _plan_id NOT IN ('starter','pro','elite','center') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
 INSERT INTO public.teacher_renewal_requests(teacher_id,plan_id) VALUES(auth.uid(),_plan_id) ON CONFLICT(teacher_id) WHERE status='pending' DO UPDATE SET plan_id=EXCLUDED.plan_id RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE FUNCTION public.review_teacher_renewal(_request_id uuid,_approve boolean,_days integer,_kind text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req public.teacher_renewal_requests; period_id uuid;
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _approve IS NULL THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT * INTO req FROM public.teacher_renewal_requests WHERE id=_request_id FOR UPDATE;
 IF NOT FOUND OR req.status<>'pending' THEN RAISE EXCEPTION 'Pending request required'; END IF;
 IF _approve THEN period_id:=public.grant_teacher_access(req.teacher_id,req.plan_id,_days,_kind,_reason); END IF;
 UPDATE public.teacher_renewal_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, reviewed_at=now(),reviewed_by=auth.uid(),access_period_id=period_id WHERE id=_request_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_subscription_teachers(),public.grant_teacher_access(uuid,text,integer,text,text),public.request_teacher_renewal(text),public.review_teacher_renewal(uuid,boolean,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_subscription_teachers(),public.grant_teacher_access(uuid,text,integer,text,text),public.request_teacher_renewal(text),public.review_teacher_renewal(uuid,boolean,integer,text,text) TO authenticated,service_role;