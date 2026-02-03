-- ==============================================================================
-- DATABASE LINT FIXES
-- Run this script in your Supabase SQL Editor to fix the reported linting issues.
-- ==============================================================================

-- 1. FIX: Security Definer Views (Error)
-- Make views use the permissions of the user querying them (security_invoker)
-- instead of the view owner. This obeys RLS policies.
ALTER VIEW public.staff_attendance_history SET (security_invoker = true);
ALTER VIEW public.device_activity_log SET (security_invoker = true);
ALTER VIEW public.daily_attendance_summary SET (security_invoker = true);

-- 2. FIX: Function Search Path Mutable (Warning)
-- Set a fixed search_path for security-critical functions to prevent
-- malicious code execution via search_path manipulation.

-- For generic utility functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.generate_pairing_code() SET search_path = public;
ALTER FUNCTION public.generate_device_token() SET search_path = public;

-- For the face matching function
-- Note: You might need to adjust the arguments if your signature differs.
-- We verify the signature based on your previous usage (organization_id, threshold, embedding filter).
-- Assuming signature: match_users_by_face(filter_organization_id uuid, match_threshold float, query_embedding text/vector)
-- We set it to 'public, extensions' to ensure it can find the 'vector' extension operators.

DO $$
BEGIN
  -- Flexible block to attempt fixing match_users_by_face regardless of exact signature
  -- This iterates over all functions named 'match_users_by_face' and sets their search path.
  DECLARE
    func_record RECORD;
  BEGIN
    FOR func_record IN 
      SELECT oid::regprocedure as name 
      FROM pg_proc 
      WHERE proname = 'match_users_by_face'
    LOOP
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', func_record.name);
    END LOOP;
  END;
$$;

-- 3. FIX: RLS Enabled but No Policy (Info)
-- These tables have RLS enabled but no policies, meaning NO ONE can access them
-- via the API (unless they are service_role).
-- We add basic permissive policies for authenticated users to match your App's pattern.

-- attendance_sessions
CREATE POLICY "Enable all for authenticated" ON public.attendance_sessions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- departments
CREATE POLICY "Enable all for authenticated" ON public.departments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- face_enrollments
CREATE POLICY "Enable all for authenticated" ON public.face_enrollments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- screen_pairs
CREATE POLICY "Enable all for authenticated" ON public.screen_pairs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- shifts
CREATE POLICY "Enable all for authenticated" ON public.shifts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sync_queue
CREATE POLICY "Enable all for authenticated" ON public.sync_queue
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. NOTE: Extension in Public
-- The linter recommends moving 'vector' to 'extensions' schema.
-- Run these only if you are sure you want to move the extension.
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- ALTER DATABASE postgres SET search_path TO public, extensions;
