ALTER TABLE public.teacher_access_periods ADD COLUMN billing_cycle text CHECK (billing_cycle IN ('monthly','yearly'));
ALTER TABLE public.teacher_renewal_requests ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly'));
CREATE FUNCTION public.grant_teacher_subscription(_teacher_id uuid,_plan_id text,_billing_cycle text,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE start_time timestamptz; new_id uuid;
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _billing_cycle IS NULL OR _billing_cycle NOT IN ('monthly','yearly') OR _plan_id IS NULL OR _plan_id NOT IN ('pro','elite','center') OR _reason IS NULL OR length(_reason)>1000 THEN RAISE EXCEPTION 'Invalid subscription'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_teacher_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_teacher_id,'teacher') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_teacher_id) THEN RAISE EXCEPTION 'Teacher account required'; END IF;
 SELECT greatest(now(),coalesce(max(ends_at),now())) INTO start_time FROM public.teacher_access_periods WHERE teacher_id=_teacher_id;
 INSERT INTO public.teacher_access_periods(teacher_id,plan_id,kind,starts_at,ends_at,granted_by,reason,billing_cycle) VALUES(_teacher_id,_plan_id,'manual_subscription',start_time,start_time+CASE WHEN _billing_cycle='monthly' THEN interval '1 month' ELSE interval '1 year' END,auth.uid(),_reason,_billing_cycle) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE FUNCTION public.request_teacher_subscription(_plan_id text,_billing_cycle text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT public.has_role(auth.uid(),'teacher') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _billing_cycle IS NULL OR _billing_cycle NOT IN ('monthly','yearly') OR _plan_id IS NULL OR _plan_id NOT IN ('pro','elite','center') THEN RAISE EXCEPTION 'Invalid subscription'; END IF;
 INSERT INTO public.teacher_renewal_requests(teacher_id,plan_id,billing_cycle) VALUES(auth.uid(),_plan_id,_billing_cycle) ON CONFLICT(teacher_id) WHERE status='pending' DO UPDATE SET plan_id=EXCLUDED.plan_id,billing_cycle=EXCLUDED.billing_cycle RETURNING id INTO new_id;
 RETURN new_id;
END $$;
CREATE FUNCTION public.review_teacher_subscription(_request_id uuid,_approve boolean,_kind text,_days integer,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req public.teacher_renewal_requests; period_id uuid;
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _approve IS NULL THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT * INTO req FROM public.teacher_renewal_requests WHERE id=_request_id FOR UPDATE;
 IF NOT FOUND OR req.status<>'pending' THEN RAISE EXCEPTION 'Pending request required'; END IF;
 IF _approve THEN
  IF _kind='complimentary' THEN period_id:=public.grant_teacher_access(req.teacher_id,req.plan_id,_days,_kind,_reason);
  ELSIF _kind='manual_subscription' THEN period_id:=public.grant_teacher_subscription(req.teacher_id,req.plan_id,req.billing_cycle,_reason);
  ELSE RAISE EXCEPTION 'Invalid period kind'; END IF;
 END IF;
 UPDATE public.teacher_renewal_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=auth.uid(),access_period_id=period_id WHERE id=_request_id;
END $$;
REVOKE ALL ON FUNCTION public.grant_teacher_subscription(uuid,text,text,text),public.request_teacher_subscription(text,text),public.review_teacher_subscription(uuid,boolean,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.grant_teacher_subscription(uuid,text,text,text),public.request_teacher_subscription(text,text),public.review_teacher_subscription(uuid,boolean,text,integer,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.grant_teacher_access(_teacher_id uuid,_plan_id text,_days integer,_kind text,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE start_time timestamptz; new_id uuid;
BEGIN
 IF NOT public.has_admin_permission('subscriptions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _days IS NULL OR _days<1 OR _days>3650 OR _plan_id IS NULL OR _plan_id NOT IN ('starter','pro','elite','center') OR _kind IS NULL OR _kind<>'complimentary' OR _reason IS NULL OR length(_reason)>1000 THEN RAISE EXCEPTION 'Invalid complimentary period'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_teacher_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_teacher_id,'teacher') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_teacher_id) THEN RAISE EXCEPTION 'Teacher account required'; END IF;
 SELECT greatest(now(),coalesce(max(ends_at),now())) INTO start_time FROM public.teacher_access_periods WHERE teacher_id=_teacher_id;
 INSERT INTO public.teacher_access_periods(teacher_id,plan_id,kind,starts_at,ends_at,granted_by,reason) VALUES(_teacher_id,_plan_id,'complimentary',start_time,start_time+make_interval(days=>_days),auth.uid(),_reason) RETURNING id INTO new_id;
 RETURN new_id;
END $$;