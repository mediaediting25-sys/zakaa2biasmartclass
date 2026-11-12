CREATE TABLE public.admin_permissions (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 permission text NOT NULL CHECK (permission IN ('users','roles','pricing','news','settings','subscriptions')),
 granted_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,permission)
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or own permission reads" ON public.admin_permissions FOR SELECT TO authenticated USING (NOT public.is_account_blocked() AND (public.is_platform_owner() OR user_id=auth.uid()));
CREATE FUNCTION public.has_admin_permission(_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND (public.is_platform_owner() OR (public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.admin_permissions WHERE user_id=auth.uid() AND permission=_permission)))
$$;
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;
CREATE FUNCTION public.set_admin_permission(_user_id uuid,_permission text,_grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_user_id,'admin') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Only non-owner administrators may be assigned permissions'; END IF;
 IF _permission NOT IN ('users','roles','pricing','news','settings','subscriptions') THEN RAISE EXCEPTION 'Invalid permission'; END IF;
 IF _grant THEN INSERT INTO public.admin_permissions(user_id,permission,granted_by) VALUES(_user_id,_permission,auth.uid()) ON CONFLICT(user_id,permission) DO UPDATE SET granted_by=EXCLUDED.granted_by,updated_at=now();
 ELSE DELETE FROM public.admin_permissions WHERE user_id=_user_id AND permission=_permission; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_permission(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_admin_permission(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_list_accounts() RETURNS TABLE(user_id uuid,full_name text,email text,roles text[],is_owner boolean,is_blocked boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (public.has_admin_permission('users') OR public.has_admin_permission('roles')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,COALESCE(array_agg(r.role::text) FILTER(WHERE r.role IS NOT NULL),ARRAY[]::text[]),EXISTS(SELECT 1 FROM public.platform_owners o WHERE o.user_id=p.id),EXISTS(SELECT 1 FROM public.blocked_accounts b WHERE b.user_id=p.id) FROM public.profiles p LEFT JOIN public.user_roles r ON r.user_id=p.id GROUP BY p.id ORDER BY p.created_at DESC;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid,_role public.app_role,_grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _owner boolean;
BEGIN
 IF NOT public.has_admin_permission('roles') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 _owner:=public.is_platform_owner();
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Owner roles are protected'; END IF;
 IF NOT _owner AND (_role='admin' OR public.has_role(_user_id,'admin')) THEN RAISE EXCEPTION 'Only owner manages administrators'; END IF;
 IF NOT _grant AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role<>_role) THEN RAISE EXCEPTION 'At least one role required'; END IF;
 IF _grant THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role;
 IF _role='admin' THEN DELETE FROM public.admin_permissions WHERE user_id=_user_id; END IF;
 END IF;
 INSERT INTO public.role_audit(actor_id,target_id,role,granted) VALUES(auth.uid(),_user_id,_role,_grant);
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_blocked(_user_id uuid,_blocked boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _owner boolean;
BEGIN
 IF NOT public.has_admin_permission('users') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 _owner:=public.is_platform_owner();
 IF _user_id=auth.uid() THEN RAISE EXCEPTION 'You cannot block your own account'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'The platform owner cannot be blocked'; END IF;
 IF NOT _owner AND public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'Only owner manages administrators'; END IF;
 IF _blocked THEN INSERT INTO public.blocked_accounts(user_id,blocked_by) VALUES(_user_id,auth.uid()) ON CONFLICT(user_id) DO UPDATE SET blocked_by=EXCLUDED.blocked_by,blocked_at=now();
 ELSE DELETE FROM public.blocked_accounts WHERE user_id=_user_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO service_role;