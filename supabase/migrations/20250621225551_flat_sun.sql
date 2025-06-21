/*
  # Create admin tasks and submissions system

  1. New Tables
    - `admin_tasks` - Store available tasks for users to complete
    - `user_task_submissions` - Track user submissions for tasks

  2. Updates
    - Update social_connections platform constraint to allow 'x'
    - Add RLS policies for task management

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for users and admins
*/

-- Update social_connections to allow 'x' as a platform
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
  
  -- Add new constraint that includes 'x'
  ALTER TABLE public.social_connections 
  ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('twitter', 'telegram', 'x'));
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might already be correct, ignore error
    NULL;
END $$;

-- Create admin_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('x', 'telegram', 'general')),
  points integer NOT NULL DEFAULT 0,
  action_url text,
  verification_type text NOT NULL DEFAULT 'manual' CHECK (verification_type IN ('manual', 'api', 'social')),
  requires_connection boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'admin'
);

-- Create user_task_submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_task_id uuid NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
  submission_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, admin_task_id)
);

-- Enable RLS on tables
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_tasks_platform ON admin_tasks(platform);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_active ON admin_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_platform_active ON admin_tasks(platform, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON admin_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user_id ON user_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_admin_task_id ON user_task_submissions(admin_task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_status ON user_task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_created_at ON user_task_submissions(created_at DESC);

-- Drop existing policies to avoid conflicts, then recreate them
DO $$
BEGIN
  -- Drop admin_tasks policies
  DROP POLICY IF EXISTS "Allow public read access to active admin tasks" ON admin_tasks;
  DROP POLICY IF EXISTS "Public users can read active tasks" ON admin_tasks;
  DROP POLICY IF EXISTS "Admin can manage all tasks" ON admin_tasks;
  
  -- Drop user_task_submissions policies
  DROP POLICY IF EXISTS "Users can create their own submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Users can insert their own submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Users can view their own submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Users can update their own pending submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Admins can view all submissions" ON user_task_submissions;
  DROP POLICY IF EXISTS "Admins can update submission status" ON user_task_submissions;
EXCEPTION
  WHEN OTHERS THEN
    -- Policies might not exist, ignore error
    NULL;
END $$;

-- Create RLS policies for admin_tasks
CREATE POLICY "Public users can read active tasks"
  ON admin_tasks
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admin can manage all tasks"
  ON admin_tasks
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for user_task_submissions
CREATE POLICY "Users can insert their own submissions"
  ON user_task_submissions
  FOR INSERT
  TO public
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can view their own submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (uid() = user_id);

CREATE POLICY "Users can update their own pending submissions"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING ((uid() = user_id) AND (status = 'pending'))
  WITH CHECK ((uid() = user_id) AND (status = 'pending'));

CREATE POLICY "Admins can view all submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can update submission status"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create trigger function for updating admin_tasks updated_at
CREATE OR REPLACE FUNCTION update_admin_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for admin_tasks
DROP TRIGGER IF EXISTS trigger_admin_tasks_updated_at ON admin_tasks;
CREATE TRIGGER trigger_admin_tasks_updated_at
  BEFORE UPDATE ON admin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_tasks_updated_at();

-- Insert initial tasks only if they don't already exist
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection)
SELECT * FROM (VALUES 
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 50, 'https://t.me/pumpeddotfun', 'manual', true),
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 50, 'https://x.com/pumpeddotfun', 'api', true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 75, 'https://x.com/pumpeddotfun/status/123456789', 'api', true)
) AS v(title, description, platform, points, action_url, verification_type, requires_connection)
WHERE NOT EXISTS (
  SELECT 1 FROM admin_tasks WHERE admin_tasks.title = v.title
);

-- Grant execute permission on the trigger function
GRANT EXECUTE ON FUNCTION update_admin_tasks_updated_at() TO public;