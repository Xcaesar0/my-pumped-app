/*
  # Fix X platform tasks in database

  1. Updates
    - Ensure admin_tasks table has correct platform values for X tasks
    - Update existing Twitter tasks to use 'x' platform
    - Ensure proper task data exists

  2. Data Updates
    - Update any existing tasks with platform 'twitter' to 'x'
    - Insert missing X platform tasks if they don't exist
*/

-- Update any existing tasks that might have 'twitter' platform to 'x'
UPDATE admin_tasks 
SET platform = 'x' 
WHERE platform = 'twitter';

-- Delete any duplicate tasks to avoid conflicts
DELETE FROM admin_tasks 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM admin_tasks 
  GROUP BY title, platform
);

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