/*
  # Update social connections platform constraint

  1. Data Cleanup
    - Remove any existing social connections that are not telegram
    - This ensures the new constraint can be applied successfully
  
  2. Constraint Update
    - Drop the existing platform check constraint
    - Add new constraint that only allows 'telegram' platform
  
  3. Security
    - Maintains existing RLS policies
    - No changes to table structure or permissions
*/

-- First, remove any existing social connections that are not telegram
-- This prevents the constraint violation error
DELETE FROM social_connections 
WHERE platform != 'telegram';

-- Drop the existing platform constraint
ALTER TABLE social_connections 
DROP CONSTRAINT IF EXISTS social_connections_platform_check;

-- Add the new constraint that only allows telegram
ALTER TABLE social_connections 
ADD CONSTRAINT social_connections_platform_check 
CHECK (platform = 'telegram');