ALTER TABLE public.admin_permissions DROP CONSTRAINT admin_permissions_permission_check;
ALTER TABLE public.admin_permissions ADD CONSTRAINT admin_permissions_permission_check CHECK (permission IN ('general_admin','users','roles','pricing','news','settings','subscriptions','subjects'));
CREATE OR REPLACE FUNCTION public.has_admin_permission(_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _permission IN ('general_admin','users','roles','pricing','news','settings','subscriptions','subjects') AND auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND (public.is_platform_owner() OR (public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.admin_permissions WHERE user_id=auth.uid() AND permission IN (_permission,'general_admin'))))
$$;
CREATE OR REPLACE FUNCTION public.set_admin_permission(_user_id uuid, _permission text, _grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_user_id,'admin') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Only non-owner administrators may be assigned permissions'; END IF;
 IF _permission IS NULL OR _grant IS NULL OR _permission NOT IN ('general_admin','users','roles','pricing','news','settings','subscriptions','subjects') THEN RAISE EXCEPTION 'Invalid permission'; END IF;
 IF _grant THEN INSERT INTO public.admin_permissions(user_id,permission,granted_by) VALUES(_user_id,_permission,auth.uid()) ON CONFLICT(user_id,permission) DO UPDATE SET granted_by=EXCLUDED.granted_by,updated_at=now();
 ELSE DELETE FROM public.admin_permissions WHERE user_id=_user_id AND permission=_permission; END IF;
END $$;
REVOKE ALL ON FUNCTION public.has_admin_permission(text), public.set_admin_permission(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text), public.set_admin_permission(uuid,text,boolean) TO authenticated;
CREATE TABLE public.platform_subjects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_key text NOT NULL UNIQUE CHECK (length(btrim(subject_key)) BETWEEN 1 AND 100),
 name_ar text NOT NULL CHECK (length(btrim(name_ar)) BETWEEN 1 AND 100),
 name_en text NOT NULL CHECK (length(btrim(name_en)) BETWEEN 1 AND 100),
 active boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 10000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_subjects TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_subjects TO authenticated;
GRANT ALL ON public.platform_subjects TO service_role;
ALTER TABLE public.platform_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible subject reads" ON public.platform_subjects FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "Subject editor reads" ON public.platform_subjects FOR SELECT TO authenticated USING (public.has_admin_permission('subjects'));
CREATE POLICY "Subject editor inserts" ON public.platform_subjects FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('subjects'));
CREATE POLICY "Subject editor updates" ON public.platform_subjects FOR UPDATE TO authenticated USING (public.has_admin_permission('subjects')) WITH CHECK (public.has_admin_permission('subjects'));
CREATE UNIQUE INDEX platform_subjects_name_ar_unique ON public.platform_subjects (lower(btrim(name_ar)));
CREATE UNIQUE INDEX platform_subjects_name_en_unique ON public.platform_subjects (lower(btrim(name_en)));
CREATE FUNCTION public.validate_subject_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.subject_key IS DISTINCT FROM OLD.subject_key) THEN RAISE EXCEPTION 'Subject identity cannot change'; END IF;
 NEW.name_ar=btrim(NEW.name_ar); NEW.name_en=btrim(NEW.name_en); NEW.updated_at=now();
 RETURN NEW;
END $$;
CREATE TRIGGER validate_subject_identity BEFORE INSERT OR UPDATE ON public.platform_subjects FOR EACH ROW EXECUTE FUNCTION public.validate_subject_identity();