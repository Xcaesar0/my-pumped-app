/*
  # Update referral code generation to use only A-Z and 0-9

  1. Function Updates
    - Update generate_referral_code function to only use uppercase letters and digits
    - Ensure codes are between 6-12 characters long
    - Remove any special characters or symbols

  2. Data Updates
    - Update all existing users' referral codes to use new format
    - Ensure all codes are clean alphanumeric only

  3. Validation
    - Update validation functions to match new requirements
*/

-- Update the generate_referral_code function to only use A-Z and 0-9
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  attempt_count integer := 0;
  max_attempts integer := 20;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code_length integer := 8; -- Default to 8 characters
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
      -- Add 4 characters based on timestamp and user ID
      code := code || substr(upper(replace(user_id_param::text, '-', '')), 1, 4);
      -- Ensure only valid characters (A-Z, 0-9)
      code := regexp_replace(code, '[^A-Z0-9]', '', 'g');
      -- Pad or trim to exactly 8 characters
      IF length(code) < 8 THEN
        WHILE length(code) < 8 LOOP
          code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
      END IF;
      code := substr(code, 1, 8);
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Update the validation function to match new requirements
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if code contains only A-Z and 0-9, and is between 6-12 characters
  RETURN code ~ '^[A-Z0-9]{6,12}$';
END;
$$;

-- Force regenerate ALL referral codes to ensure they meet new requirements
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE id IS NOT NULL;

-- Update the process_referral_from_code function to use stricter validation
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
  
  -- Clean the referral code (uppercase, remove any non-alphanumeric)
  clean_code := upper(regexp_replace(trim(referral_code_param), '[^A-Z0-9]', '', 'g'));
  
  -- Validate code format (A-Z and 0-9 only, 6-12 characters)
  IF NOT validate_referral_code(clean_code) THEN
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION validate_referral_code(text) TO public;
GRANT EXECUTE ON FUNCTION process_referral_from_code(text, uuid) TO public;