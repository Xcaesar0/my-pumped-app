/*
  # Fix admin tasks platform and ensure proper task data

  1. Changes
    - Update any existing 'twitter' platform tasks to 'x'
    - Remove duplicate tasks based on title and platform
    - Ensure X platform tasks exist with correct configuration
    - Ensure Telegram task exists with proper settings

  2. Security
    - No RLS changes needed as admin_tasks already has proper policies
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