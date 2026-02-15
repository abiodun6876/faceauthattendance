-- Create table for Platform Audit Logs
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow super admins to view all logs
-- Note: This assumes the app handles the "super admin" check via RPC or session
-- For now, we allow access to facilitate development, but in production, 
-- this should be restricted to verified platform_admins.
CREATE POLICY "Super Admins can view all audit logs" 
ON public.platform_audit_logs 
FOR SELECT 
USING (true); 

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.platform_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.platform_audit_logs (admin_email);
