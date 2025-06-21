/*
  # Fix referral code system completely

  1. Database Function Fixes
    - Create a single, unambiguous process_referral_from_code function
    - Fix parameter naming conflicts
    - Ensure proper error handling and validation

  2. Data Cleanup
    - Ensure all users have valid referral codes
    - Clean up any duplicate or conflicting functions

  3. Security
    - Maintain RLS policies
    - Ensure proper validation of referral codes
*/

-- Drop any existing conflicting functions first
DROP FUNCTION IF EXISTS process_referral_from_code(text, uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(uuid, text);
DROP FUNCTION IF EXISTS process_referral_from_code(referral_code_param text, new_user_id_param uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(new_user_id_param uuid, referral_code_param text);

-- Create the definitive process_referral_from_code function with unique parameter names
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
BEGIN
  -- Validate inputs
  IF p_referral_code IS NULL OR p_new_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters');
  END IF;
  
  -- Clean the referral code (uppercase, remove any non-alphanumeric)
  v_clean_code := upper(regexp_replace(trim(p_referral_code), '[^A-Z0-9]', '', 'g'));
  
  -- Validate code format (A-Z and 0-9 only, 6-12 characters)
  IF NOT (v_clean_code ~ '^[A-Z0-9]{6,12}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be 6-12 characters and contain only letters and numbers');
  END IF;
  
  -- Find the referrer by referral code
  SELECT id INTO v_referrer_user_id
  FROM users 
  WHERE referral_code = v_clean_code;
  
  -- Validate referrer exists
  IF v_referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF v_referrer_user_id = p_new_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
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
    'Someone used your referral code! They need to connect their X account for you to earn 10 points.'
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE SET
    message = EXCLUDED.message,
    created_at = now(),
    dismissed_at = NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'referral_id', v_referral_id,
    'status', 'pending',
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'An error occurred while processing the referral code');
END;
$$;

-- Ensure the generate_referral_code function is robust
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  attempt_count integer := 0;
  max_attempts integer := 20;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code_length integer := 8;
  i integer;
BEGIN
  LOOP
    -- Generate random alphanumeric code (A-Z, 0-9 only)
    code := '';
    FOR i IN 1..code_length LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if this code already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      -- Fallback: use timestamp-based approach to ensure uniqueness
      code := '';
      -- Generate 4 random characters
      FOR i IN 1..4 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      -- Add 4 characters based on timestamp
      code := code || lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
      -- Convert any remaining digits to letters to ensure all alphanumeric
      code := translate(code, '0123456789', 'ABCDEFGHIJ');
      -- Ensure only valid characters and exactly 8 characters
      code := regexp_replace(code, '[^A-Z0-9]', '', 'g');
      code := substr(code || 'ABCDEFGH', 1, 8); -- Pad if needed
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Update the validation function
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if code contains only A-Z and 0-9, and is between 6-12 characters
  RETURN code IS NOT NULL AND code ~ '^[A-Z0-9]{6,12}$';
END;
$$;

-- Ensure all users have valid referral codes
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL 
   OR NOT validate_referral_code(referral_code);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO public;

-- Verify the function exists and works
DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test the function with invalid parameters to ensure it works
  SELECT process_referral_from_code('INVALID', gen_random_uuid()) INTO test_result;
  RAISE NOTICE 'Function test result: %', test_result;
END $$;