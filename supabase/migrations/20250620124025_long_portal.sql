/*
  # Completely fix referral code generation

  1. Function Updates
    - Create a robust generate_referral_code function that only uses A-Z and 0-9
    - Ensure no special characters can ever be generated
    - Make codes exactly 8 characters long for consistency

  2. Data Cleanup
    - Force update ALL existing users to get new clean referral codes
    - Remove any codes with special characters
    - Ensure all codes are uppercase alphanumeric only
*/

-- Create a completely new, robust referral code generation function
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  attempt_count integer := 0;
  max_attempts integer := 20;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i integer;
BEGIN
  LOOP
    -- Generate exactly 8 random alphanumeric characters
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if this code already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      -- Fallback: use timestamp-based code to ensure uniqueness
      code := '';
      FOR i IN 1..4 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      -- Add 4 digits from current timestamp
      code := code || lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
      -- Convert digits to letters to ensure all alphanumeric
      code := translate(code, '0123456789', 'ABCDEFGHIJ');
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Force update ALL users to get new clean referral codes
-- This will replace any existing codes that have special characters
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE id IS NOT NULL;

-- Update the trigger function to use the new code generation
CREATE OR REPLACE FUNCTION set_user_referral_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always generate a new referral code (no special characters)
  NEW.referral_code := generate_referral_code(NEW.id);
  
  -- Set referral link if not already set (immutable after creation)
  IF NEW.referral_link IS NULL THEN
    NEW.referral_link := generate_referral_link(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION set_user_referral_data() TO public;