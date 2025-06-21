/*
  # Fix X platform tasks in database

  1. Updates
    - Update any existing tasks with 'twitter' platform to 'x'
    - Remove duplicate tasks to avoid conflicts
    - Ensure correct X platform tasks exist with proper data
    - Maintain Telegram task as well

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions
*/

-- Update any existing tasks that might have 'twitter' platform to 'x'
UPDATE admin_tasks 
SET platform = 'x' 
WHERE platform = 'twitter';

-- Delete duplicate tasks using a different approach that works with UUIDs
DELETE FROM admin_tasks a1
WHERE EXISTS (
  SELECT 1 FROM admin_tasks a2 
  WHERE a2.title = a1.title 
    AND a2.platform = a1.platform 
    AND a2.created_at < a1.created_at
);

-- First, delete any existing tasks with these titles to avoid conflicts
DELETE FROM admin_tasks 
WHERE title IN ('Follow @pumpeddotfun', 'Repost Launch Post', 'Join Telegram');

-- Insert the correct X platform tasks
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection, is_active)
VALUES 
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 50, 'https://x.com/pumpeddotfun', 'api', true, true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 75, 'https://x.com/pumpeddotfun/status/123456789', 'api', true, true),
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 50, 'https://t.me/pumpeddotfun', 'manual', true, true);