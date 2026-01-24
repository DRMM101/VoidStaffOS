-- Migration: Add employee tiers
-- Tiers 1-5 where 1 is highest (e.g., Senior Manager) and 5 is lowest (e.g., Junior Employee)
-- Admin role sits outside the tiering system (tier = NULL)

-- Add tier column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier INTEGER CHECK (tier >= 1 AND tier <= 5);

-- Add comment for clarity
COMMENT ON COLUMN users.tier IS 'Employee tier 1-5 (1=highest, 5=lowest). NULL for Admin role.';

-- Update existing users with default tiers based on role
-- Managers get tier 2, Employees get tier 4, others get tier 3
UPDATE users SET tier =
  CASE
    WHEN role_id = (SELECT id FROM roles WHERE role_name = 'Admin') THEN NULL
    WHEN role_id = (SELECT id FROM roles WHERE role_name = 'Manager') THEN 2
    WHEN role_id = (SELECT id FROM roles WHERE role_name = 'Employee') THEN 4
    WHEN role_id = (SELECT id FROM roles WHERE role_name = 'Compliance Officer') THEN 3
    WHEN role_id = (SELECT id FROM roles WHERE role_name = 'Whistleblowing Officer') THEN 3
    ELSE 4
  END
WHERE tier IS NULL;

-- Create index for tier queries
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
