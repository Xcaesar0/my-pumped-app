/*
  # Social Media Connections Schema

  1. New Tables
    - `social_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `platform` (text, 'twitter' or 'telegram')
      - `platform_user_id` (text, external platform user ID)
      - `platform_username` (text, external platform username)
      - `access_token` (text, encrypted OAuth token)
      - `refresh_token` (text, encrypted OAuth refresh token)
      - `token_expires_at` (timestamp, token expiration)
      - `connected_at` (timestamp, connection timestamp)
      - `is_active` (boolean, connection status)

  2. Security
    - Enable RLS on `social_connections` table
    - Add policies for authenticated users to manage their own connections
    - Create indexes for performance

  3. Changes
    - Add unique constraint on user_id + platform combination
    - Add check constraint for valid platforms
*/

CREATE TABLE IF NOT EXISTS social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('twitter', 'telegram')),
  platform_user_id text NOT NULL,
  platform_username text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, platform)
);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_user_id ON social_connections(platform_user_id);

-- Create RLS policies
CREATE POLICY "Users can read their own social connections"
  ON social_connections
  FOR SELECT
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  ));

CREATE POLICY "Users can insert their own social connections"
  ON social_connections
  FOR INSERT
  TO public
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  ));

CREATE POLICY "Users can update their own social connections"
  ON social_connections
  FOR UPDATE
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  ));

CREATE POLICY "Users can delete their own social connections"
  ON social_connections
  FOR DELETE
  TO public
  USING (user_id IN (
    SELECT id FROM users WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  ));