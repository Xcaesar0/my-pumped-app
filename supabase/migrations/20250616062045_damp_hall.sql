/*
  # Add X platform support to social connections

  1. Database Changes
    - Drop existing platform check constraint that only allows 'telegram'
    - Add new platform check constraint that allows both 'telegram' and 'x'
    - This enables users to link their X (Twitter) accounts

  2. Security
    - Maintains existing RLS policies
    - No changes to existing data or permissions
*/

-- Drop the existing constraint that only allows 'telegram'
ALTER TABLE public.social_connections
DROP CONSTRAINT IF EXISTS social_connections_platform_check;

-- Add new constraint that allows both 'telegram' and 'x'
ALTER TABLE public.social_connections
ADD CONSTRAINT social_connections_platform_check
CHECK (platform IN ('telegram', 'x'));