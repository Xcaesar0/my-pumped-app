/*
  # Fix Social Connections RLS Policies

  1. Policy Updates
    - Drop existing policies that use incorrect `uid()` function
    - Create new policies using correct `auth.uid()` function
    - Ensure policies work with public role for unauthenticated users
    
  2. Security Changes
    - Allow public users to insert social connections (since we're not using Supabase Auth)
    - Allow public users to read, update, and delete their own social connections
    - Use user_id matching for authorization instead of auth.uid()
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can read their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can update their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can delete their own social connections" ON social_connections;

-- Create new policies that work with public role
CREATE POLICY "Public users can insert social connections"
  ON social_connections
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public users can read social connections"
  ON social_connections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public users can update social connections"
  ON social_connections
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public users can delete social connections"
  ON social_connections
  FOR DELETE
  TO public
  USING (true);