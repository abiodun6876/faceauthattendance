-- Create table for Platform Admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    secondary_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with matching emails to read their own record
CREATE POLICY "Admins can view their own data" 
ON public.platform_admins 
FOR SELECT 
USING (auth.jwt() ->> 'email' = email);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_platform_admins_updated_at ON public.platform_admins;

-- Update timestamp on change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_platform_admins_updated_at
    BEFORE UPDATE ON public.platform_admins
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- INSERT INITIAL RECORD (Owner)
-- Instructions: Change 'Nigeram2026@?' if you want a different dashboard password.
INSERT INTO public.platform_admins (email, secondary_password)
VALUES ('nigeramventures@gmail.com', 'Nigeram2026@?')
ON CONFLICT (email) DO NOTHING;
