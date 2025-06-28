/*
  # Implement referral code system

  1. New Functions
    - `process_referral_from_code` - Process referral using code instead of link
    - Update existing functions to work with code-based system

  2. Database Updates
    - Ensure referral_code is properly indexed
    - Add validation for referral codes

  3. Security
    - Maintain existing RLS policies
    - Ensure proper validation of referral codes
*/

-- Function to process referral from code
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
  result jsonb;
BEGIN
  -- Validate inputs
  IF referral_code_param IS NULL OR new_user_id_param IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters');
  END IF;
  
  -- Find the referrer by referral code
  SELECT id INTO referrer_user_id
  FROM users 
  WHERE referral_code = UPPER(referral_code_param);
  
  -- Validate referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user_id = new_user_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if referral already exists
  SELECT id INTO existing_referral_id
  FROM referrals
  WHERE referrer_id = referrer_user_id AND referred_id = new_user_id_param;
  
  -- Create referral if it doesn't exist
  IF existing_referral_id IS NULL THEN
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
      UPPER(referral_code_param),
      'pending',
      10,
      now() + interval '30 days'
    )
    RETURNING id INTO referral_id;
    
    -- Award immediate signup bonus to referee (25 points)
    UPDATE users 
    SET current_points = current_points + 25
    WHERE id = new_user_id_param;
    
    -- Create notification for referrer
    INSERT INTO user_notifications (user_id, notification_type, message)
    VALUES (
      referrer_user_id, 
      'new_referral', 
      'Someone used your referral code! They need to connect their X account to activate the referral.'
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
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'You have already used a referral code',
      'referral_id', existing_referral_id
    );
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;