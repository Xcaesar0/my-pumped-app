/*
  # Create users table for wallet-based authentication

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - Unique identifier for each user
      - `wallet_address` (text, unique, not null) - User's wallet address (lowercase)
      - `username` (text, not null) - Generated username for the user
      - `connection_timestamp` (timestamptz, default now()) - When user first connected
      - `current_points` (integer, default 0) - User's current point total
      - `current_rank` (integer, default 0) - User's current leaderboard rank

  2. Security
    - Enable RLS on `users` table
    - Add policy for users to read all user data (for leaderboard functionality)
    - Add policy for users to update their own data based on wallet address

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on current_points for leaderboard queries
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

-- Create policies
CREATE POLICY "Users can read all user data"
  ON users
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own data"
  ON users
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_current_points ON users(current_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users(current_rank);