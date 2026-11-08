CREATE TABLE public.platform_owners (user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.platform_owners TO authenticated;
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ownership" ON public.platform_owners FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.role_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, target_id uuid NOT NULL, role public.app_role NOT NULL, granted boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.role_audit TO authenticated;
GRANT ALL ON public.role_audit TO service_role;
ALTER TABLE public.role_audit ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_platform_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;
CREATE POLICY "owner audit access" ON public.role_audit FOR SELECT TO authenticated USING(public.is_platform_owner());
CREATE OR REPLACE FUNCTION public.admin_list_users() RETURNS TABLE(user_id uuid,full_name text,email text,roles text[],is_owner boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_platform_owner() OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,COALESCE(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL),ARRAY[]::text[]),EXISTS(SELECT 1 FROM public.platform_owners o WHERE o.user_id=p.id) FROM public.profiles p LEFT JOIN public.user_roles r ON r.user_id=p.id GROUP BY p.id ORDER BY p.created_at DESC;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid,_role public.app_role,_grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _owner boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
 _owner:=public.is_platform_owner();
 IF NOT (_owner OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Owner roles are protected'; END IF;
 IF NOT _owner AND (_role='admin' OR public.has_role(_user_id,'admin')) THEN RAISE EXCEPTION 'Only owner manages administrators'; END IF;
 IF NOT _grant AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role<>_role) THEN RAISE EXCEPTION 'At least one role required'; END IF;
 IF _grant THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role; END IF;
 INSERT INTO public.role_audit(actor_id,target_id,role,granted) VALUES(auth.uid(),_user_id,_role,_grant);
END $$;
REVOKE ALL ON FUNCTION public.admin_list_users(),public.admin_set_role(uuid,public.app_role,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(),public.admin_set_role(uuid,public.app_role,boolean) TO authenticated;