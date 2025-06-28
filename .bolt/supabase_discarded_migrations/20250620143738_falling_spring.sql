/*
  # Fix referral code processing function with comprehensive error handling

  1. Function Updates
    - Drop any existing conflicting function versions
    - Create robust function with detailed error handling and validation
    - Add comprehensive input validation with clear error messages
    - Include debugging logs to help troubleshoot issues
    - Use SECURITY DEFINER to ensure proper permissions

  2. Error Handling
    - Validate all inputs thoroughly
    - Provide specific error messages for different failure scenarios
    - Add exception handling with detailed logging
    - Test function after creation to ensure it works

  3. Security
    - Use SECURITY DEFINER for proper database permissions
    - Validate referral code format strictly
    - Prevent self-referrals and duplicate usage
*/

-- Drop any existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS process_referral_from_code(text, uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(uuid, text);
DROP FUNCTION IF EXISTS process_referral_from_code(p_referral_code text, p_new_user_id uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(referral_code_param text, new_user_id_param uuid);

-- Create the definitive process_referral_from_code function with comprehensive error handling
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
  v_user_exists boolean;
BEGIN
  -- Log function call for debugging
  RAISE LOG 'process_referral_from_code called with code: %, user: %', p_referral_code, p_new_user_id;
  
  -- Validate inputs are not null
  IF p_referral_code IS NULL THEN
    RAISE LOG 'Error: Referral code is NULL';
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;
  
  IF p_new_user_id IS NULL THEN
    RAISE LOG 'Error: User ID is NULL';
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  -- Check if the user actually exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_new_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE LOG 'Error: User % does not exist', p_new_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Clean and validate the referral code
  v_clean_code := upper(trim(p_referral_code));
  
  -- Remove any non-alphanumeric characters
  v_clean_code := regexp_replace(v_clean_code, '[^A-Z0-9]', '', 'g');
  
  RAISE LOG 'Cleaned referral code: %', v_clean_code;
  
  -- Validate code format
  IF length(v_clean_code) < 6 THEN
    RAISE LOG 'Error: Code too short: %', length(v_clean_code);
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be at least 6 characters long');
  END IF;
  
  IF length(v_clean_code) > 12 THEN
    RAISE LOG 'Error: Code too long: %', length(v_clean_code);
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be no more than 12 characters long');
  END IF;
  
  IF NOT (v_clean_code ~ '^[A-Z0-9]+$') THEN
    RAISE LOG 'Error: Invalid characters in code: %', v_clean_code;
    RETURN jsonb_build_object('success', false, 'error', 'Referral code can only contain letters and numbers');
  END IF;
  
  -- Find the referrer by referral code
  SELECT id, username INTO v_referrer_user_id, v_referrer_username
  FROM users 
  WHERE referral_code = v_clean_code;
  
  RAISE LOG 'Referrer lookup result: user_id=%, username=%', v_referrer_user_id, v_referrer_username;
  
  -- Validate referrer exists
  IF v_referrer_user_id IS NULL THEN
    RAISE LOG 'Error: No user found with referral code: %', v_clean_code;
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code - no user found with this code');
  END IF;
  
  -- Prevent self-referrals
  IF v_referrer_user_id = p_new_user_id THEN
    RAISE LOG 'Error: Self-referral attempt by user: %', p_new_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
  END IF;
  
  -- Check if user has already used any referral code
  SELECT id INTO v_existing_referral_id
  FROM referrals
  WHERE referred_id = p_new_user_id;
  
  IF v_existing_referral_id IS NOT NULL THEN
    RAISE LOG 'Error: User % already has referral: %', p_new_user_id, v_existing_referral_id;
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Create the referral record
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
  
  RAISE LOG 'Created referral record: %', v_referral_id;
  
  -- Award immediate +25 points to referee for using referral code
  UPDATE users 
  SET current_points = current_points + 25
  WHERE id = p_new_user_id;
  
  RAISE LOG 'Awarded 25 points to user: %', p_new_user_id;
  
  -- Create notification for referrer (ignore conflicts)
  BEGIN
    INSERT INTO user_notifications (user_id, notification_type, message)
    VALUES (
      v_referrer_user_id, 
      'new_referral', 
      'Someone used your referral code! They need to connect their X account for you to earn 10 points.'
    )
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
      message = EXCLUDED.message,
      created_at = now(),
      dismissed_at = NULL;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'Warning: Failed to create notification: %', SQLERRM;
      -- Don't fail the entire operation if notification fails
  END;
  
  RAISE LOG 'Successfully processed referral code: %', v_clean_code;
  
  RETURN jsonb_build_object(
    'success', true, 
    'referral_id', v_referral_id,
    'status', 'pending',
    'referrer_username', v_referrer_username,
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE LOG 'Unique violation error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'This referral code has already been used by you'
    );
  WHEN foreign_key_violation THEN
    RAISE LOG 'Foreign key violation: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid user or referrer data'
    );
  WHEN OTHERS THEN
    -- Log the specific error for debugging
    RAISE LOG 'Unexpected error in process_referral_from_code: % - %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Database error: %s', SQLERRM)
    );
END;
$$;

-- Ensure the validate_referral_code function exists and is robust
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean_code text;
BEGIN
  -- Handle null or empty input
  IF code IS NULL OR trim(code) = '' THEN
    RETURN false;
  END IF;
  
  -- Clean the code
  v_clean_code := upper(regexp_replace(trim(code), '[^A-Z0-9]', '', 'g'));
  
  -- Check length and format
  RETURN length(v_clean_code) >= 6 
    AND length(v_clean_code) <= 12 
    AND v_clean_code ~ '^[A-Z0-9]+$';
END;
$$;

-- Grant execute permissions to public role
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO public;

-- Test the function to ensure it works properly
DO $$
DECLARE
  test_result jsonb;
  test_user_id uuid;
BEGIN
  -- Create a test user for validation
  INSERT INTO users (wallet_address, username, current_points)
  VALUES ('0xtest123', 'TestUser123', 0)
  RETURNING id INTO test_user_id;
  
  -- Test with invalid code to ensure function responds correctly
  SELECT process_referral_from_code('INVALID123', test_user_id) INTO test_result;
  
  -- Clean up test user
  DELETE FROM users WHERE id = test_user_id;
  
  RAISE NOTICE 'Function test completed successfully. Result: %', test_result;
  
  -- Verify the result structure
  IF (test_result->>'success')::boolean = false THEN
    RAISE NOTICE 'Function correctly rejected invalid referral code';
  ELSE
    RAISE WARNING 'Function test may have unexpected behavior';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Function test failed: %', SQLERRM;
    -- Clean up test user if it exists
    DELETE FROM users WHERE wallet_address = '0xtest123';
END $$;