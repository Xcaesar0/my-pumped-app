/*
  # Clean up unused database components

  1. Remove unused tables and functions
    - Drop admin_tasks table (not used in frontend)
    - Drop user_task_submissions table (not used in frontend)
    - Drop related functions and triggers
    - Clean up unused RLS policies

  2. Update social_connections constraint
    - Ensure 'x' platform is supported alongside 'telegram'

  3. Security
    - Maintain existing RLS policies for core tables
    - Remove policies for dropped tables
*/

-- Drop user_task_submissions table first (has foreign key dependencies)
DROP TABLE IF EXISTS user_task_submissions CASCADE;

-- Drop admin_tasks table
DROP TABLE IF EXISTS admin_tasks CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS update_admin_tasks_updated_at() CASCADE;

-- Update social_connections to ensure 'x' platform is supported
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
  
  -- Add new constraint that includes 'x' and 'telegram'
  ALTER TABLE public.social_connections 
  ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('telegram', 'x'));
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might already be correct, ignore error
    NULL;
END $$;

-- Clean up any orphaned policies (these tables no longer exist)
DO $$
BEGIN
  -- These will fail silently if tables don't exist
  DROP POLICY IF EXISTS "Public users can read active tasks" ON admin_tasks;
  DROP POLICY IF EXISTS "Admin can manage all tasks" ON admin_tasks;
  DROP POLICY IF EXISTS "Users can insert their own submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Users can view their own submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Users can update their own pending submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Admins can view all submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Admins can update submission status" ON user_task_submissions;
EXCEPTION
  WHEN OTHERS THEN
    -- Tables don't exist, ignore errors
    NULL;
END $$;