/*
  # Fix admin tasks migration with proper unique constraint

  1. Schema Changes
    - Add unique constraint on title column for admin_tasks table
    - Update existing tasks to use 'x' platform instead of 'twitter'
    - Insert or update admin tasks with proper conflict resolution

  2. Data Changes
    - Ensure X platform tasks exist with correct configuration
    - Ensure Telegram task exists with correct configuration
*/

-- First, remove any duplicate tasks by title (keep the oldest one)
DELETE FROM admin_tasks a1
WHERE EXISTS (
  SELECT 1 FROM admin_tasks a2 
  WHERE a2.title = a1.title 
  AND a2.created_at < a1.created_at
);

-- Add unique constraint on title column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admin_tasks_title_key'
  ) THEN
    ALTER TABLE admin_tasks ADD CONSTRAINT admin_tasks_title_key UNIQUE (title);
  END IF;
END $$;

-- Update any existing tasks that might have 'twitter' platform to 'x'
UPDATE admin_tasks 
SET platform = 'x' 
WHERE platform = 'twitter';

-- Now we can safely use ON CONFLICT with the unique constraint
-- Ensure the X platform tasks exist with correct data
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection, is_active)
VALUES 
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 50, 'https://x.com/pumpeddotfun', 'api', true, true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 75, 'https://x.com/pumpeddotfun/status/123456789', 'api', true, true)
ON CONFLICT (title) DO UPDATE SET
  platform = EXCLUDED.platform,
  description = EXCLUDED.description,
  points = EXCLUDED.points,
  action_url = EXCLUDED.action_url,
  verification_type = EXCLUDED.verification_type,
  requires_connection = EXCLUDED.requires_connection,
  is_active = EXCLUDED.is_active;

-- Ensure Telegram task exists too
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection, is_active)
VALUES 
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 50, 'https://t.me/pumpeddotfun', 'manual', true, true)
ON CONFLICT (title) DO UPDATE SET
  platform = EXCLUDED.platform,
  description = EXCLUDED.description,
  points = EXCLUDED.points,
  action_url = EXCLUDED.action_url,
  verification_type = EXCLUDED.verification_type,
  requires_connection = EXCLUDED.requires_connection,
  is_active = EXCLUDED.is_active;