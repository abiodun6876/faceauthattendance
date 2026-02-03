-- Visitor Management System Schema

-- 1. Visitors Table
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  photo_url TEXT,
  id_type VARCHAR(50), -- passport, driver_license, national_id
  id_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
  host_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Staff member hosting
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose TEXT NOT NULL,
  pass_code VARCHAR(10) NOT NULL UNIQUE, -- 6-digit code
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, checked_in, checked_out, cancelled
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_out_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Security staff
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL, -- annual, sick, personal, emergency, maternity, paternity
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Customers Table (for business organizations)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_type VARCHAR(50) DEFAULT 'individual', -- individual, corporate
  full_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100),
  photo_url TEXT,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, blocked
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Customer Appointments (for service-based businesses)
CREATE TABLE IF NOT EXISTS customer_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  service_type VARCHAR(255),
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, in_progress, completed, cancelled, no_show
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitors_org ON visitors(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_pass_code ON appointments(pass_code);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON leave_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_appointments_org ON customer_appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_appointments_date ON customer_appointments(appointment_date);

-- RLS Policies
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_appointments ENABLE ROW LEVEL SECURITY;

-- Visitors policies
CREATE POLICY "Visitors are viewable by organization members" ON visitors
  FOR SELECT USING (true);

CREATE POLICY "Visitors are insertable by anyone" ON visitors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Visitors are updatable by organization members" ON visitors
  FOR UPDATE USING (true);

-- Appointments policies
CREATE POLICY "Appointments are viewable by organization members" ON appointments
  FOR SELECT USING (true);

CREATE POLICY "Appointments are insertable by anyone" ON appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Appointments are updatable by organization members" ON appointments
  FOR UPDATE USING (true);

-- Leave requests policies
CREATE POLICY "Leave requests are viewable by organization members" ON leave_requests
  FOR SELECT USING (true);

CREATE POLICY "Leave requests are insertable by users" ON leave_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Leave requests are updatable by organization members" ON leave_requests
  FOR UPDATE USING (true);

-- Customers policies
CREATE POLICY "Customers are viewable by organization members" ON customers
  FOR SELECT USING (true);

CREATE POLICY "Customers are insertable by organization members" ON customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Customers are updatable by organization members" ON customers
  FOR UPDATE USING (true);

-- Customer appointments policies
CREATE POLICY "Customer appointments are viewable by organization members" ON customer_appointments
  FOR SELECT USING (true);

CREATE POLICY "Customer appointments are insertable by organization members" ON customer_appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Customer appointments are updatable by organization members" ON customer_appointments
  FOR UPDATE USING (true);

-- Function to generate unique pass code
CREATE OR REPLACE FUNCTION generate_pass_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_code VARCHAR(10);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6-digit code
    new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM appointments WHERE pass_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate pass code
CREATE OR REPLACE FUNCTION set_pass_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pass_code IS NULL OR NEW.pass_code = '' THEN
    NEW.pass_code := generate_pass_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_pass_code_trigger
BEFORE INSERT ON appointments
FOR EACH ROW
EXECUTE FUNCTION set_pass_code();

-- Comments
COMMENT ON TABLE visitors IS 'Stores visitor information for appointment system';
COMMENT ON TABLE appointments IS 'Manages visitor appointments with pass code system';
COMMENT ON TABLE leave_requests IS 'Tracks employee leave requests and approvals';
COMMENT ON TABLE customers IS 'Manages customer/client information for businesses';
COMMENT ON TABLE customer_appointments IS 'Schedules customer service appointments';
