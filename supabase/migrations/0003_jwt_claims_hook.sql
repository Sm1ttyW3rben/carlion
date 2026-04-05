-- =============================================================================
-- Migration 0003: JWT Custom Claims Hook
-- =============================================================================
-- Supabase calls this function whenever a JWT is issued or refreshed.
-- It adds tenant_id and role as custom claims to the JWT payload.
-- RLS policies read these claims via auth.jwt() ->> 'tenant_id'.
--
-- This function must be registered in the Supabase Dashboard:
--   Authentication → Hooks → Custom Access Token Hook
--   Select function: public.custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_role text;
  v_claims jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;

  -- Look up the user's tenant and role from the users table
  SELECT u.tenant_id, u.role::text
  INTO v_tenant_id, v_role
  FROM users u
  WHERE u.id = v_user_id;

  -- If user is not found in users table yet (during registration),
  -- return the event unchanged and let the registration flow add the user
  IF v_tenant_id IS NULL THEN
    RETURN event;
  END IF;

  -- Merge custom claims into the existing claims
  v_claims := event -> 'claims';
  v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  v_claims := jsonb_set(v_claims, '{role}', to_jsonb(v_role));

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- Grant execute permission to the supabase_auth_admin role
-- (required for Supabase Auth to call this hook)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- =============================================================================
-- Tenant Registration Helper
-- Called after a new user registers to create their tenant + user record.
-- Used in the registration API route (server-side, service role).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_and_user(
  p_auth_user_id uuid,
  p_email text,
  p_tenant_name text,
  p_tenant_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
  v_counter int := 0;
BEGIN
  -- Ensure unique slug (append counter if collision)
  v_slug := p_tenant_slug;
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := p_tenant_slug || '-' || v_counter;
  END LOOP;

  -- Create tenant
  INSERT INTO tenants (name, slug, plan, status, trial_ends_at)
  VALUES (
    p_tenant_name,
    v_slug,
    'trial',
    'trial',
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_tenant_id;

  -- Create user as owner
  INSERT INTO users (id, tenant_id, email, role)
  VALUES (p_auth_user_id, v_tenant_id, p_email, 'owner');

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_and_user TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_tenant_and_user FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_tenant_and_user FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_tenant_and_user FROM anon;
