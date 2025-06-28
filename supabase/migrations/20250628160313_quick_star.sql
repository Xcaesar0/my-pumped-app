/*
  # Create Admin Tasks and User Task Submissions Tables

  1. New Tables
    - `admin_tasks` - Stores available tasks for users to complete
    - `user_task_submissions` - Tracks user submissions for tasks

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for data access

  3. Data
    - Insert default tasks for X and Telegram
*/

-- Create admin_tasks table
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  platform text NOT NULL CHECK (platform IN ('x', 'telegram', 'general')),
  points integer DEFAULT 0,
  action_url text,
  verification_type text DEFAULT 'manual' CHECK (verification_type IN ('manual', 'api', 'social')),
  requires_connection boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_task_submissions table
CREATE TABLE IF NOT EXISTS user_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_task_id uuid NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
  submission_data jsonb DEFAULT '{}',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, admin_task_id)
);

-- Enable RLS
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_tasks
CREATE POLICY "Public can read active admin tasks"
  ON admin_tasks
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create policies for user_task_submissions
CREATE POLICY "Public can read user task submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can create user task submissions"
  ON user_task_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update user task submissions"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_tasks_platform ON admin_tasks(platform);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_active ON admin_tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user_id ON user_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_admin_task_id ON user_task_submissions(admin_task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_status ON user_task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user_status ON user_task_submissions(user_id, status);

-- Insert some default admin tasks
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection) VALUES
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 25, 'https://t.me/pumpeddotfun', 'manual', true),
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 25, 'https://x.com/pumpeddotfun', 'manual', true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 50, 'https://x.com/pumpeddotfun/status/123456789', 'manual', true)
ON CONFLICT DO NOTHING;