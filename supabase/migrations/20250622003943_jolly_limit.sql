/*
  # Fix admin tasks platform and ensure proper task data

  1. Changes
    - Update any existing 'twitter' platform tasks to 'x'
    - Remove duplicate tasks safely using row_number() instead of MIN()
    - Ensure X platform tasks exist with correct data
    - Ensure Telegram task exists

  2. Security
    - Updates existing admin_tasks table
    - Uses UPSERT pattern for safe data insertion
*/

-- Update any existing tasks that might have 'twitter' platform to 'x'
UPDATE admin_tasks 
SET platform = 'x' 
WHERE platform = 'twitter';

-- Delete duplicate tasks using row_number() instead of MIN() for UUID compatibility
DELETE FROM admin_tasks 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY title, platform ORDER BY created_at) as rn
    FROM admin_tasks
  ) ranked
  WHERE rn > 1
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