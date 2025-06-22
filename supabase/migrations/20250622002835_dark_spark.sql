/*
  # Fix user_notifications table structure

  1. Changes
    - Add missing `message` column to `user_notifications` table
    - This column is required by the social connection functionality

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions
*/

-- Add the missing message column to user_notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_notifications' AND column_name = 'message'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN message text;
  END IF;
END $$;

-- Update the unique constraint to include message if needed
-- (The existing constraint should still work fine)