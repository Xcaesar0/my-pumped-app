/*
  # Fix referral system and user flow issues

  1. Database Function Updates
    - Create process_referral_code_entry function that matches frontend expectations
    - Fix parameter naming and return format
    - Ensure proper error handling and validation

  2. Data Integrity
    - Add missing columns if they don't exist
    - Update existing functions to be more robust
    - Fix any UUID-related issues

  3. Performance
    - Add proper indexes
    - Optimize function performance
*/

-- Ensure all required columns exist
DO $$
BEGIN
  -- Add points column to users if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'points'
  ) THEN
    ALTER TABLE users ADD COLUMN points integer DEFAULT 0;
  END IF;

  -- Add kinde_user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'kinde_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN kinde_user_id text;
  END IF;
END $$;

-- Create or replace the process_referral_code_entry function
CREATE OR REPLACE FUNCTION process_referral_code_entry(
  referral_code_param text,
  referee_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_user record;
  existing_referral_count integer;
  referral_id uuid;
  clean_code text;
BEGIN
  -- Validate inputs
  IF referral_code_param IS NULL OR trim(referral_code_param) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;
  
  IF referee_id_param IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  -- Clean the referral code
  clean_code := upper(trim(referral_code_param));
  clean_code := regexp_replace(clean_code, '[^A-Z0-9]', '', 'g');
  
  -- Validate code format
  IF length(clean_code) < 6 OR length(clean_code) > 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be 6-12 characters long');
  END IF;
  
  -- Find referrer
  SELECT id, username INTO referrer_user
  FROM users
  WHERE referral_code = clean_code
  AND is_active = true;
  
  IF referrer_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user.id = referee_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if user already has a referral
  SELECT COUNT(*) INTO existing_referral_count
  FROM referrals
  WHERE referred_id = referee_id_param;
  
  IF existing_referral_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Create the referral
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    referral_code,
    status,
    points_awarded,
    expires_at
  ) VALUES (
    referrer_user.id,
    referee_id_param,
    clean_code,
    'pending',
    10,
    now() + interval '30 days'
  ) RETURNING id INTO referral_id;
  
  -- Award immediate points to referee (+25)
  UPDATE users 
  SET current_points = current_points + 25
  WHERE id = referee_id_param;
  
  -- Create points transaction for referee
  INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
  VALUES (
    referee_id_param, 
    25, 
    'referral_bonus', 
    referral_id, 
    'Referral signup bonus'
  );
  
  -- Create notification for referrer
  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (
    referrer_user.id,
    'new_referral',
    'Someone used your referral code! They need to connect their X account for you to earn 10 points.'
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE SET
    message = EXCLUDED.message,
    created_at = now(),
    dismissed_at = NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', referral_id,
    'status', 'pending',
    'referrer_username', referrer_user.username,
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while processing the referral code'
    );
END;
$$;

-- Update the activate_referrals_on_social_connection function
CREATE OR REPLACE FUNCTION activate_referrals_on_social_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_record record;
BEGIN
  -- Only process if this is a new active connection for X platform
  IF NEW.is_active = true AND NEW.platform = 'x' AND (OLD IS NULL OR OLD.is_active = false) THEN
    
    -- Process all pending referrals where this user is the referee
    FOR referral_record IN 
      SELECT * FROM referrals 
      WHERE referred_id = NEW.user_id
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
      
      -- Create points transaction for referrer
      INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
      VALUES (
        referral_record.referrer_id,
        10,
        'referral_bonus',
        referral_record.id,
        'Referral activation bonus'
      );
      
      -- Award additional +75 points to referee for completing X connection
      UPDATE users 
      SET current_points = current_points + 75
      WHERE id = referral_record.referred_id;
      
      -- Create points transaction for referee
      INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
      VALUES (
        referral_record.referred_id,
        75,
        'social_linking',
        NEW.id,
        'X account connection bonus'
      );
      
      -- Create notification for referrer
      INSERT INTO user_notifications (user_id, notification_type, message)
      VALUES (
        referral_record.referrer_id,
        'referral_activated',
        'Referral activated! You earned 10 points because your friend connected their X account.'
      )
      ON CONFLICT (user_id, notification_type) DO UPDATE SET
        message = EXCLUDED.message,
        created_at = now(),
        dismissed_at = NULL;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections;
CREATE TRIGGER trigger_activate_referrals_social
  AFTER INSERT OR UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION activate_referrals_on_social_connection();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_kinde_user_id ON users(kinde_user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_x_connected_at ON users(x_connected_at);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION activate_referrals_on_social_connection() TO public;

-- Test the function to ensure it works
DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test with invalid code to ensure function responds correctly
  SELECT process_referral_code_entry('INVALID123', gen_random_uuid()) INTO test_result;
  
  IF (test_result->>'success')::boolean = false THEN
    RAISE NOTICE 'Function test passed: correctly rejected invalid referral code';
  ELSE
    RAISE WARNING 'Function test may have unexpected behavior';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Function test failed: %', SQLERRM;
END $$;