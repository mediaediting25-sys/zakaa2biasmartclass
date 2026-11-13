ALTER TABLE public.admin_permissions DROP CONSTRAINT admin_permissions_permission_check;
ALTER TABLE public.admin_permissions ADD CONSTRAINT admin_permissions_permission_check CHECK (permission IN ('general_admin','users','roles','pricing','news','settings','subscriptions'));
CREATE OR REPLACE FUNCTION public.has_admin_permission(_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _permission IN ('general_admin','users','roles','pricing','news','settings','subscriptions') AND auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND (public.is_platform_owner() OR (public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.admin_permissions WHERE user_id=auth.uid() AND permission IN (_permission,'general_admin'))))
$$;
CREATE OR REPLACE FUNCTION public.set_admin_permission(_user_id uuid,_permission text,_grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT public.is_platform_owner() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_user_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_role(_user_id,'admin') OR EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id=_user_id) THEN RAISE EXCEPTION 'Only non-owner administrators may be assigned permissions'; END IF;
 IF _permission IS NULL OR _grant IS NULL OR _permission NOT IN ('general_admin','users','roles','pricing','news','settings','subscriptions') THEN RAISE EXCEPTION 'Invalid permission'; END IF;
 IF _grant THEN INSERT INTO public.admin_permissions(user_id,permission,granted_by) VALUES(_user_id,_permission,auth.uid()) ON CONFLICT(user_id,permission) DO UPDATE SET granted_by=EXCLUDED.granted_by,updated_at=now();
 ELSE DELETE FROM public.admin_permissions WHERE user_id=_user_id AND permission=_permission; END IF;
END $$;
CREATE TABLE public.platform_plan_overrides (
 id text PRIMARY KEY CHECK(id IN ('starter','pro','elite','center')),
 price_egp numeric NOT NULL DEFAULT 0 CHECK(price_egp>=0),
 price_sar numeric NOT NULL DEFAULT 0 CHECK(price_sar>=0),
 price_usd numeric NOT NULL DEFAULT 0 CHECK(price_usd>=0),
 name_ar text NOT NULL DEFAULT '', name_en text NOT NULL DEFAULT '',
 features_ar text[] NOT NULL DEFAULT '{}', features_en text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plan_overrides TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.platform_plan_overrides TO authenticated;
GRANT ALL ON public.platform_plan_overrides TO service_role;
ALTER TABLE public.platform_plan_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public plan reads" ON public.platform_plan_overrides FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Pricing editors" ON public.platform_plan_overrides FOR ALL TO authenticated USING(public.has_admin_permission('pricing')) WITH CHECK(public.has_admin_permission('pricing'));
CREATE TRIGGER touch_plan_overrides BEFORE UPDATE ON public.platform_plan_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.platform_settings (
 id text PRIMARY KEY CHECK(id='public'), announcement_ar text NOT NULL DEFAULT '', announcement_en text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public announcement reads" ON public.platform_settings FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "Settings editors" ON public.platform_settings FOR ALL TO authenticated USING(public.has_admin_permission('settings')) WITH CHECK(public.has_admin_permission('settings'));
CREATE TRIGGER touch_platform_settings BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.platform_news (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title_ar text NOT NULL, title_en text NOT NULL DEFAULT '', body_ar text NOT NULL, body_en text NOT NULL DEFAULT '',
 category text NOT NULL DEFAULT 'education' CHECK(category IN ('education','update')),
 published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_news TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.platform_news TO authenticated;
GRANT ALL ON public.platform_news TO service_role;
ALTER TABLE public.platform_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published news reads" ON public.platform_news FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY "News editor draft reads and writes" ON public.platform_news FOR ALL TO authenticated USING(public.has_admin_permission('news')) WITH CHECK(public.has_admin_permission('news'));
CREATE TRIGGER touch_platform_news BEFORE UPDATE ON public.platform_news FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();