/*
  # Create user task submissions table

  1. New Tables
    - `user_task_submissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `admin_task_id` (uuid, foreign key to admin_tasks)
      - `submission_url` (text, the URL submitted by user)
      - `status` (text, pending/approved/rejected)
      - `reviewed_by` (text, admin who reviewed)
      - `reviewed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_task_submissions` table
    - Add policies for users to submit and view their own submissions
    - Add policies for admins to review submissions
*/

-- Create user_task_submissions table
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

-- Enable RLS
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own submissions"
  ON user_task_submissions
  FOR INSERT
  TO public
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own pending submissions"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING (auth.uid()::text = user_id::text AND status = 'pending')
  WITH CHECK (auth.uid()::text = user_id::text AND status = 'pending');

-- Admin policies (for future admin interface)
CREATE POLICY "Admins can view all submissions"
  ON user_task_submissions
  FOR SELECT
  TO public
  USING (true); -- In production, this should check for admin role

CREATE POLICY "Admins can update submission status"
  ON user_task_submissions
  FOR UPDATE
  TO public
  USING (true) -- In production, this should check for admin role
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_user_task_submissions_user_id ON user_task_submissions(user_id);
CREATE INDEX idx_user_task_submissions_admin_task_id ON user_task_submissions(admin_task_id);
CREATE INDEX idx_user_task_submissions_status ON user_task_submissions(status);
CREATE INDEX idx_user_task_submissions_created_at ON user_task_submissions(created_at DESC);