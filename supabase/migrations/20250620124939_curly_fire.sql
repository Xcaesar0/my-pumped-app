/*
  # Fix Referral System - Complete Implementation

  1. Updates to existing functions
    - Fix activate_referrals_on_x_connection to award +10 points to referrer when referee connects X
    - Ensure process_referral_from_code validates codes properly
    - Update all referral codes to be alphanumeric only

  2. New validation functions
    - Add function to validate referral code format
    - Ensure all codes are stored in uppercase

  3. Points system fixes
    - Referee gets +25 points immediately when using code
    - Referrer gets +10 points when referee connects X account
    - All point awards are atomic and safe
*/

-- Update the activate_referrals_on_x_connection function to properly award +10 points to referrer
CREATE OR REPLACE FUNCTION activate_referrals_on_x_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referral_record record;
BEGIN
  -- Check if X account was just connected
  IF OLD.x_connected_at IS NULL AND NEW.x_connected_at IS NOT NULL THEN
    
    -- Process all pending referrals where this user is the referee
    FOR referral_record IN 
      SELECT * FROM referrals 
      WHERE referred_id = NEW.id AND status = 'pending' AND expires_at > now()
    LOOP
      -- Update referral status to active
      UPDATE referrals 
      SET status = 'active', activated_at = now()
      WHERE id = referral_record.id;
      
      -- Award +10 points to referrer (this is the key fix)
      UPDATE users 
      SET current_points = current_points + 10
      WHERE id = referral_record.referrer_id;
      
      -- Award additional +75 points to referee for completing X connection
      UPDATE users 
      SET current_points = current_points + 75
      WHERE id = referral_record.referred_id;
      
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
      
      -- Update task progress for referrer
      PERFORM update_task_progress(referral_record.referrer_id);
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update process_referral_from_code to ensure proper validation and point awards
CREATE OR REPLACE FUNCTION process_referral_from_code(
  referral_code_param text, 
  new_user_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id uuid;
  existing_referral_id uuid;
  referral_id uuid;
  clean_code text;
  result jsonb;
BEGIN
  -- Validate inputs
  IF referral_code_param IS NULL OR new_user_id_param IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters');
  END IF;
  
  -- Clean and validate the referral code
  clean_code := UPPER(trim(referral_code_param));
  
  -- Validate code format (alphanumeric only, 6-12 characters)
  IF NOT (clean_code ~ '^[A-Z0-9]{6,12}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be 6-12 characters and contain only letters and numbers');
  END IF;
  
  -- Find the referrer by referral code
  SELECT id INTO referrer_user_id
  FROM users 
  WHERE referral_code = clean_code;
  
  -- Validate referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user_id = new_user_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if user has already used any referral code
  SELECT id INTO existing_referral_id
  FROM referrals
  WHERE referred_id = new_user_id_param;
  
  IF existing_referral_id IS NOT NULL THEN
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
  )
  VALUES (
    referrer_user_id, 
    new_user_id_param, 
    clean_code,
    'pending',
    10, -- Points that referrer will get when referee connects X
    now() + interval '30 days'
  )
  RETURNING id INTO referral_id;
  
  -- Award immediate +25 points to referee for using referral code
  UPDATE users 
  SET current_points = current_points + 25
  WHERE id = new_user_id_param;
  
  -- Create notification for referrer
  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (
    referrer_user_id, 
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
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
END;
$$;

-- Function to validate referral code format
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if code is alphanumeric only and between 6-12 characters
  RETURN code ~ '^[A-Z0-9]{6,12}$';
END;
$$;

-- Update all existing referral codes to ensure they are clean alphanumeric
UPDATE users 
SET referral_code = (
  SELECT generate_referral_code(id)
)
WHERE referral_code IS NULL 
   OR NOT validate_referral_code(referral_code);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION activate_referrals_on_x_connection() TO public;
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO public;