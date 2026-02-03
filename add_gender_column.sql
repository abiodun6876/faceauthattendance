-- Add gender column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- Add comment
COMMENT ON COLUMN users.gender IS 'User gender (optional)';
