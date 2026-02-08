-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    type TEXT NOT NULL DEFAULT 'company', -- company, school
    settings JSONB DEFAULT '{}'::jsonb,
    branding JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    staff_id TEXT, -- Student ID or Staff ID
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    gender TEXT,
    user_role TEXT DEFAULT 'staff', -- admin, manager, staff, driver, security
    enrollment_status TEXT DEFAULT 'pending', -- pending, enrolled
    face_embedding_stored BOOLEAN DEFAULT false,
    face_photo_url TEXT,
    face_embedding TEXT, -- Legacy reference or storage
    face_enrolled_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Face Enrollments Table (for vector search)
CREATE TABLE IF NOT EXISTS face_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    embedding vector(128) NOT NULL, -- Assuming 128 dimensions for face-api.js/common models
    photo_url TEXT NOT NULL,
    quality_score DOUBLE PRECISION,
    enrollment_location TEXT,
    capture_device TEXT,
    is_primary BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Devices Table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    device_code TEXT UNIQUE NOT NULL,
    device_type TEXT DEFAULT 'face_recognition',
    device_token TEXT,
    pairing_code TEXT,
    device_ip INET,
    location_note TEXT,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'present', -- present, late, absent, half_day
    verification_method TEXT DEFAULT 'face', -- face, card, manual
    confidence_score DOUBLE PRECISION,
    face_match_score DOUBLE PRECISION,
    photo_url TEXT,
    synced BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Visitors Table
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    photo_url TEXT,
    id_type TEXT, -- passport, driver_license, national_id
    id_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
    host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    purpose TEXT NOT NULL,
    pass_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, checked_in, checked_out, cancelled
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_out_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    customer_type TEXT DEFAULT 'individual',
    full_name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    tax_id TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Customer Appointments Table
CREATE TABLE IF NOT EXISTS customer_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    service_type TEXT,
    status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, in_progress, completed, cancelled, no_show
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    vehicle_name TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'car',
    make TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    vin TEXT,
    fuel_type TEXT,
    transmission TEXT,
    mileage INTEGER,
    last_service_date DATE,
    next_service_date DATE,
    insurance_expiry DATE,
    registration_expiry DATE,
    permit_expiry DATE,
    inspection_expiry DATE,
    road_tax_expiry DATE,
    current_driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'available',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Vehicle Trips Table
CREATE TABLE IF NOT EXISTS vehicle_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_name TEXT NOT NULL,
    purpose TEXT,
    start_location TEXT,
    end_location TEXT,
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    scheduled_end_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    distance_km DOUBLE PRECISION,
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    driver_check_in_time TIMESTAMP WITH TIME ZONE,
    driver_check_out_time TIMESTAMP WITH TIME ZONE,
    security_check_in_time TIMESTAMP WITH TIME ZONE,
    security_check_out_time TIMESTAMP WITH TIME ZONE,
    security_notes TEXT,
    google_maps_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Trip Checkpoints Table
CREATE TABLE IF NOT EXISTS trip_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES vehicle_trips(id) ON DELETE CASCADE,
    checkpoint_name TEXT NOT NULL,
    location TEXT,
    expected_time TIMESTAMP WITH TIME ZONE,
    actual_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Maintenance Logs Table
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    service_center TEXT,
    mechanic_name TEXT,
    mileage_at_service INTEGER,
    cost DOUBLE PRECISION,
    next_service_date DATE,
    notes TEXT,
    attachments TEXT[], -- Array of photo URLs
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Document Notifications Table
CREATE TABLE IF NOT EXISTS document_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- insurance, license, registration
    expiry_date DATE NOT NULL,
    notification_type TEXT, -- sms, email, app
    status TEXT DEFAULT 'pending', -- pending, sent, dismissed
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    sent_to_phone TEXT,
    message_sent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    course_code TEXT,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    total_students INTEGER DEFAULT 0,
    attended_students INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 20. Screen Pairs Table
CREATE TABLE IF NOT EXISTS screen_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE UNIQUE,
    pair_code TEXT NOT NULL,
    screen_name TEXT,
    status TEXT DEFAULT 'pending', -- pending, paired, disconnected
    connected_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 21. Face Match Logs Table
CREATE TABLE IF NOT EXISTS face_match_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    threshold_score DOUBLE PRECISION NOT NULL,
    is_match BOOLEAN NOT NULL,
    verification_result TEXT,
    photo_url TEXT,
    capture_device TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. Sync Queue Table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL, -- insert, update, delete
    data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_face_enrollments_updated_at BEFORE UPDATE ON face_enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_appointments_updated_at BEFORE UPDATE ON customer_appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_trips_updated_at BEFORE UPDATE ON vehicle_trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trip_checkpoints_updated_at BEFORE UPDATE ON trip_checkpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_maintenance_logs_updated_at BEFORE UPDATE ON maintenance_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_notifications_updated_at BEFORE UPDATE ON document_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for Face Matching (RPC)
CREATE OR REPLACE FUNCTION match_users_by_face(
  query_embedding vector(128),
  match_threshold float,
  filter_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  staff_id text,
  photo_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.user_id,
    u.full_name,
    u.staff_id,
    fe.photo_url,
    1 - (fe.embedding <=> query_embedding) AS similarity
  FROM face_enrollments fe
  JOIN users u ON fe.user_id = u.id
  WHERE fe.organization_id = filter_organization_id
    AND fe.is_active = true
    AND 1 - (fe.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT 5;
END;
$$;

-- Views
CREATE OR REPLACE VIEW daily_attendance_summary AS
SELECT
    a.date,
    o.id AS organization_id,
    o.name AS organization_name,
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'late') AS late_count,
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'absent') AS absent_count,
    AVG(a.confidence_score) AS avg_confidence,
    (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = true) AS total_staff
FROM attendance a
JOIN organizations o ON a.organization_id = o.id
GROUP BY a.date, o.id, o.name;

CREATE OR REPLACE VIEW device_activity_log AS
SELECT
    d.id AS device_id,
    d.device_code,
    d.device_name,
    d.status AS device_status,
    d.organization_id,
    b.name AS branch_name,
    d.last_seen,
    MIN(a.created_at) AS first_activity,
    MAX(a.created_at) AS last_activity,
    COUNT(a.id) AS total_scans,
    COUNT(DISTINCT a.date) AS active_days
FROM devices d
LEFT JOIN branches b ON d.branch_id = b.id
LEFT JOIN attendance a ON a.device_id = d.id
GROUP BY d.id, b.name;

-- RLS Policies (Basic)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Organization-based policies (simplified for all)
-- In a real scenario, you would use auth.uid() and a profiles/users table to strictly enforce.
-- For now, we'll allow all authenticated users to see data from their organization.

-- Example for organizations
CREATE POLICY "Organizations are viewable by public" ON organizations FOR SELECT USING (true);

-- Example for others (template)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name != 'organizations'
    LOOP
        EXECUTE format('CREATE POLICY "Organization access for %I" ON %I FOR ALL USING (true)', t, t);
    END LOOP;
END;
$$;
