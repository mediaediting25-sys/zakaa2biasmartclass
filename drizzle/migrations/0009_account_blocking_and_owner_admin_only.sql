CREATE TABLE public.blocked_accounts (
  user_id uuid PRIMARY KEY,
  blocked_by uuid NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.blocked_accounts TO service_role;
ALTER TABLE public.blocked_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_account_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocked_accounts WHERE user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.is_account_blocked() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_blocked() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.blocked_accounts WHERE user_id = _user_id)
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE(user_id uuid, full_name text, email text, roles text[], is_owner boolean, is_blocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT (public.is_platform_owner() OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.email,
      COALESCE(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::text[]),
      EXISTS(SELECT 1 FROM public.platform_owners o WHERE o.user_id = p.id),
      EXISTS(SELECT 1 FROM public.blocked_accounts b WHERE b.user_id = p.id)
    FROM public.profiles p
    LEFT JOIN public.user_roles r ON r.user_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC;
END
$$;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
COMMENT ON FUNCTION public.admin_list_users() IS 'DEPRECATED: replaced by admin_list_accounts, which includes blocking status.';

CREATE OR REPLACE FUNCTION public.admin_set_blocked(_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner boolean;
BEGIN
  IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  _owner := public.is_platform_owner();
  IF NOT (_owner OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot block your own account'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_owners WHERE user_id = _user_id) THEN RAISE EXCEPTION 'The platform owner cannot be blocked'; END IF;
  IF NOT _owner AND public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Only the owner manages administrators'; END IF;
  IF _blocked THEN
    INSERT INTO public.blocked_accounts(user_id, blocked_by) VALUES(_user_id, auth.uid())
      ON CONFLICT (user_id) DO UPDATE SET blocked_by = EXCLUDED.blocked_by, blocked_at = now();
  ELSE
    DELETE FROM public.blocked_accounts WHERE user_id = _user_id;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public.admin_set_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_blocked(uuid, boolean) TO authenticated;

DO $$
DECLARE _table text;
BEGIN
  FOR _table IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true AND tablename <> 'blocked_accounts'
  LOOP
    EXECUTE format(
      'CREATE POLICY "blocked accounts denied" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_account_blocked()) WITH CHECK (NOT public.is_account_blocked())',
      _table
    );
  END LOOP;
END
$$;

CREATE POLICY "blocked accounts denied"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (NOT public.is_account_blocked())
WITH CHECK (NOT public.is_account_blocked());