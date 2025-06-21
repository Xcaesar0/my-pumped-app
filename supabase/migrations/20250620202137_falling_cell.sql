/*
  # Add missing is_active column to users table

  1. Changes
    - Add `is_active` column to `users` table with default value `true`
    - This resolves the database error where triggers/functions expect this column to exist

  2. Notes
    - The column is added with a default value of `true` to maintain existing functionality
    - All existing users will automatically have `is_active = true`
    - This is a safe, non-breaking change
*/

-- Add the missing is_active column to the users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add an index for performance on the new column
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);