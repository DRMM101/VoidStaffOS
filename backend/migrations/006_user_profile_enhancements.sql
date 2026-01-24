-- Migration 006: User Profile Enhancements
-- Adds employee number and manager contact details

-- Add employee_number column (unique identifier for each employee)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(20) UNIQUE;

-- Add manager contact fields (can be used to override auto-populated values)
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_contact_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_contact_phone VARCHAR(50);

-- Create index for employee number lookups
CREATE INDEX IF NOT EXISTS idx_users_employee_number ON users(employee_number);

-- Create index for manager lookups
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

-- Function to generate next employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_num INTEGER;
  emp_number VARCHAR(20);
BEGIN
  -- Get the highest existing employee number
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM users
  WHERE employee_number LIKE 'EMP%';

  -- Format as EMP001, EMP002, etc.
  emp_number := 'EMP' || LPAD(next_num::TEXT, 3, '0');

  RETURN emp_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate employee number on insert if not provided
CREATE OR REPLACE FUNCTION auto_generate_employee_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_number IS NULL OR NEW.employee_number = '' THEN
    NEW.employee_number := generate_employee_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_auto_employee_number ON users;
CREATE TRIGGER trg_auto_employee_number
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_employee_number();

-- Update existing users without employee numbers
UPDATE users
SET employee_number = 'EMP' || LPAD(id::TEXT, 3, '0')
WHERE employee_number IS NULL;
