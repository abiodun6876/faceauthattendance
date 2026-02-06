-- Run this in your Supabase SQL Editor to fix the empty response issue

-- 1. Check if RLS is enabled (it likely is)
ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vehicle_trips" ENABLE ROW LEVEL SECURITY;

-- 2. Allow anonymous/public users to VIEW vehicles
-- This solves the "response [] empty" issue
DROP POLICY IF EXISTS "Allow public select vehicles" ON "public"."vehicles";
CREATE POLICY "Allow public select vehicles"
ON "public"."vehicles"
FOR SELECT
TO public
USING (true);

-- 3. Allow anonymous/public users to VIEW trips
DROP POLICY IF EXISTS "Allow public select vehicle_trips" ON "public"."vehicle_trips";
CREATE POLICY "Allow public select vehicle_trips"
ON "public"."vehicle_trips"
FOR SELECT
TO public
USING (true);

-- 4. Allow anonymous/public users to INSERT/UPDATE trips (for scheduling/completing trips)
DROP POLICY IF EXISTS "Allow public insert vehicle_trips" ON "public"."vehicle_trips";
CREATE POLICY "Allow public insert vehicle_trips"
ON "public"."vehicle_trips"
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update vehicle_trips" ON "public"."vehicle_trips";
CREATE POLICY "Allow public update vehicle_trips"
ON "public"."vehicle_trips"
FOR UPDATE
TO public
USING (true);

-- 5. IMPORTANT: Allow viewing Users to see Driver details
-- Without this, the 'current_driver' field will be returned as null
CREATE POLICY "Allow public select users"
ON "public"."users"
FOR SELECT
TO public
USING (true);
