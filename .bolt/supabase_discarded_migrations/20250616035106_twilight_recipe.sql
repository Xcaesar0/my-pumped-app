/*
  # Fix Social Connections RLS Policies

  1. Policy Updates
    - Update all social_connections policies to use standard Supabase auth
    - Remove dependency on wallet_address JWT claims
    - Use auth.uid() directly for user identification

  2. Security
    - Maintain RLS protection
    - Ensure users can only access their own social connections
    - Keep all existing policy functionality
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can delete their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can insert their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can read their own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can update their own social connections" ON social_connections;

-- Create new policies using standard Supabase auth
CREATE POLICY "Users can insert their own social connections"
  ON social_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own social connections"
  ON social_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own social connections"
  ON social_connections
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own social connections"
  ON social_connections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());