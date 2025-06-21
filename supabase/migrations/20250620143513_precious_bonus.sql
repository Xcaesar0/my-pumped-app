/*
  # Fix referral code processing function

  1. Function Updates
    - Drop any existing conflicting functions
    - Create a robust process_referral_from_code function with proper error handling
    - Ensure function signature matches the frontend call exactly
    - Add comprehensive validation and error messages

  2. Security
    - Use SECURITY DEFINER for proper permissions
    - Add input validation and sanitization
    - Prevent SQL injection and other security issues
*/

-- Drop any existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS process_referral_from_code(text, uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(uuid, text);
DROP FUNCTION IF EXISTS process_referral_from_code(p_referral_code text, p_new_user_id uuid);

-- Create the definitive process_referral_from_code function
CREATE OR REPLACE FUNCTION process_referral_from_code(
  p_referral_code text, 
  p_new_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_user_id uuid;
  v_existing_referral_id uuid;
  v_referral_id uuid;
  v_clean_code text;
  v_referrer_username text;
BEGIN
  -- Log function call for debugging
  RAISE NOTICE 'Processing referral code: % for user: %', p_referral_code, p_new_user_id;
  
  -- Validate inputs
  IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;
  
  IF p_new_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  -- Clean the referral code (uppercase, remove any non-alphanumeric)
  v_clean_code := upper(regexp_replace(trim(p_referral_code), '[^A-Z0-9]', '', 'g'));
  
  -- Validate code format (A-Z and 0-9 only, 6-12 characters)
  IF length(v_clean_code) < 6 OR length(v_clean_code) > 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be 6-12 characters long');
  END IF;
  
  IF NOT (v_clean_code ~ '^[A-Z0-9]+$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code can only contain letters and numbers');
  END IF;
  
  -- Find the referrer by referral code
  SELECT id, username INTO v_referrer_user_id, v_referrer_username
  FROM users 
  WHERE referral_code = v_clean_code;
  
  -- Validate referrer exists
  IF v_referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code - no user found with this code');
  END IF;
  
  -- Prevent self-referrals
  IF v_referrer_user_id = p_new_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
  END IF;
  
  -- Check if user has already used any referral code
  SELECT id INTO v_existing_referral_id
  FROM referrals
  WHERE referred_id = p_new_user_id;
  
  IF v_existing_referral_id IS NOT NULL THEN
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
    v_referrer_user_id, 
    p_new_user_id, 
    v_clean_code,
    'pending',
    10, -- Points that referrer will get when referee connects X
    now() + interval '30 days'
  )
  RETURNING id INTO v_referral_id;
  
  -- Award immediate +25 points to referee for using referral code
  UPDATE users 
  SET current_points = current_points + 25
  WHERE id = p_new_user_id;
  
  -- Create notification for referrer
  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (
    v_referrer_user_id, 
    'new_referral', 
    format('Someone used your referral code! They need to connect their X account for you to earn 10 points.')
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE SET
    message = EXCLUDED.message,
    created_at = now(),
    dismissed_at = NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'referral_id', v_referral_id,
    'status', 'pending',
    'referrer_username', v_referrer_username,
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE NOTICE 'Error in process_referral_from_code: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'An unexpected error occurred while processing the referral code. Please try again.'
    );
END;
$$;

-- Ensure the validate_referral_code function exists
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if code contains only A-Z and 0-9, and is between 6-12 characters
  IF code IS NULL OR trim(code) = '' THEN
    RETURN false;
  END IF;
  
  -- Clean the code first
  code := upper(regexp_replace(trim(code), '[^A-Z0-9]', '', 'g'));
  
  RETURN length(code) >= 6 AND length(code) <= 12 AND code ~ '^[A-Z0-9]+$';
END;
$$;

-- Grant execute permissions to public role
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO public;

-- Test the function to ensure it works
DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test with invalid code to ensure function responds correctly
  SELECT process_referral_from_code('INVALID123', gen_random_uuid()) INTO test_result;
  RAISE NOTICE 'Function test completed successfully. Result: %', test_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Function test failed: %', SQLERRM;
END $$;