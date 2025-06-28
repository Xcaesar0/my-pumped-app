/*
  # Create users table with safe policy handling

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `wallet_address` (text, unique)
      - `username` (text)
      - `connection_timestamp` (timestamptz)
      - `current_points` (integer, default 0)
      - `current_rank` (integer, default 0)
  2. Security
    - Enable RLS on `users` table
    - Add policies for public access (insert, select, update)
  3. Performance
    - Add indexes for wallet address, points, and rank lookups
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  username text NOT NULL,
  connection_timestamp timestamptz DEFAULT now(),
  current_points integer DEFAULT 0,
  current_rank integer DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_current_points ON users (current_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users (current_rank);

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can insert their own data" ON users;
  DROP POLICY IF EXISTS "Users can read all user data" ON users;
  DROP POLICY IF EXISTS "Users can update their own data" ON users;
  
  -- Create new policies
  CREATE POLICY "Users can insert their own data"
    ON users
    FOR INSERT
    TO public
    WITH CHECK (true);

  CREATE POLICY "Users can read all user data"
    ON users
    FOR SELECT
    TO public
    USING (true);

  CREATE POLICY "Users can update their own data"
    ON users
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
END $$;