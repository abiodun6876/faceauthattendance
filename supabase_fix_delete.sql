-- Add RLS policy for deleting vehicles
DROP POLICY IF EXISTS "Allow public delete vehicles" ON "public"."vehicles";
CREATE POLICY "Allow public delete vehicles"
ON "public"."vehicles"
FOR DELETE
TO public
USING (true);

-- Add RLS policy for deleting trips
DROP POLICY IF EXISTS "Allow public delete vehicle_trips" ON "public"."vehicle_trips";
CREATE POLICY "Allow public delete vehicle_trips"
ON "public"."vehicle_trips"
FOR DELETE
TO public
USING (true);
