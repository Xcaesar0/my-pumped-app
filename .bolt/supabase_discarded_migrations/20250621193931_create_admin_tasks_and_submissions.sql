-- Alter social_connections to allow 'x' as a platform
ALTER TABLE public.social_connections
DROP CONSTRAINT IF EXISTS social_connections_platform_check;

ALTER TABLE public.social_connections
ADD CONSTRAINT social_connections_platform_check
CHECK (platform IN ('twitter', 'telegram', 'x'));

-- Create admin_tasks table to store available tasks
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  platform text NOT NULL CHECK (platform IN ('x', 'telegram', 'general')),
  points integer NOT NULL DEFAULT 0,
  action_url text,
  verification_type text NOT NULL DEFAULT 'manual' CHECK (verification_type IN ('manual', 'api', 'social')),
  requires_connection boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create user_task_submissions table to track user progress
CREATE TABLE IF NOT EXISTS user_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_task_id uuid NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid, -- Can be a user_id of an admin
  CONSTRAINT unique_user_task_submission UNIQUE (user_id, admin_task_id)
);

-- Enable RLS for both tables
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_tasks
CREATE POLICY "Allow public read access to active admin tasks"
  ON admin_tasks
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policies for admins will be needed to manage tasks, but this is a start
-- CREATE POLICY "Allow admin full access" ON admin_tasks TO authenticated WITH CHECK (is_admin(auth.uid()));

-- Create policies for user_task_submissions
CREATE POLICY "Users can create their own submissions"
  ON user_task_submissions
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending submissions"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id AND status = 'pending');

-- Policies for admins to review submissions will be needed
-- CREATE POLICY "Allow admin to manage submissions" ON user_task_submissions TO authenticated WITH CHECK (is_admin(auth.uid()));

-- Add some initial tasks to get started
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection)
VALUES 
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 50, 'https://t.me/pumpeddotfun', 'manual', true),
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 50, 'https://x.com/pumpeddotfun', 'api', true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 75, 'https://x.com/pumpeddotfun/status/123456789', 'api', true);
