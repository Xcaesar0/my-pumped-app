/*
  # Fix Telegram Connection Issues

  1. Database Updates
    - Ensure social_connections table has proper constraints and triggers
    - Add trigger to activate referrals when social connections are made
    - Fix any constraint issues with platform values

  2. Security
    - Maintain existing RLS policies
    - Ensure proper data validation

  3. Performance
    - Add missing indexes for social connections
*/

-- Ensure social_connections table has correct platform constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
  
  -- Add new constraint that includes 'x' and 'telegram'
  ALTER TABLE public.social_connections 
  ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('telegram', 'x'));
EXCEPTION
  WHEN OTHERS THEN
    -- Constraint might already be correct, ignore error
    NULL;
END $$;

-- Ensure all required indexes exist
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_user_id ON social_connections(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform ON social_connections(user_id, platform, is_active);

-- Create trigger function to activate referrals when social connections are made
CREATE OR REPLACE FUNCTION activate_referrals_on_social_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referral_record record;
BEGIN
  -- Only process if this is a new active connection
  IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
    
    -- Process all pending referrals where this user is the referee
    FOR referral_record IN 
      SELECT * FROM referrals 
      WHERE referred_id = (SELECT id FROM users WHERE id = NEW.user_id)
        AND status = 'pending' 
        AND expires_at > now()
    LOOP
      -- Update referral status to active
      UPDATE referrals 
      SET status = 'active', activated_at = now()
      WHERE id = referral_record.id;
      
      -- Award +10 points to referrer
      UPDATE users 
      SET current_points = current_points + 10
      WHERE id = referral_record.referrer_id;
      
      -- Award additional +75 points to referee for completing connection
      UPDATE users 
      SET current_points = current_points + 75
      WHERE id = referral_record.referred_id;
      
      -- Create notification for referrer
      INSERT INTO user_notifications (user_id, notification_type, message)
      VALUES (
        referral_record.referrer_id, 
        'referral_activated', 
        format('Referral activated! You earned 10 points because your friend connected their %s account.', NEW.platform)
      )
      ON CONFLICT (user_id, notification_type) DO UPDATE SET
        message = EXCLUDED.message,
        created_at = now(),
        dismissed_at = NULL;
      
      -- Update task progress for referrer
      BEGIN
        PERFORM update_task_progress(referral_record.referrer_id);
      EXCEPTION
        WHEN OTHERS THEN
          -- Ignore task progress errors
          NULL;
      END;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for social connections
DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections;
CREATE TRIGGER trigger_activate_referrals_social
  AFTER INSERT OR UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION activate_referrals_on_social_connection();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION activate_referrals_on_social_connection() TO public;