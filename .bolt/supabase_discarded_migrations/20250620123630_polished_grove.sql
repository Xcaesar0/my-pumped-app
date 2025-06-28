/*
  # Fix referral code generation to use only numbers and letters

  1. Function Updates
    - Update generate_referral_code function to only use alphanumeric characters
    - Remove any special characters like # from the generation logic
    - Ensure codes are always uppercase and 8-12 characters long

  2. Data Updates
    - Update existing users' referral codes to use only alphanumeric characters
    - Maintain uniqueness while fixing the format
*/

-- Update the generate_referral_code function to only use alphanumeric characters
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  attempt_count integer := 0;
  max_attempts integer := 10;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code_length integer := 8;
BEGIN
  LOOP
    -- Generate a random alphanumeric code
    code := '';
    FOR i IN 1..code_length LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Add a portion of the user ID hash to ensure some uniqueness
    code := code || substr(upper(replace(user_id_param::text, '-', '')), 1, 4);
    
    -- Ensure the code is exactly 12 characters
    code := substr(code, 1, 12);
    
    -- Check if this code already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      -- Fallback: use timestamp to ensure uniqueness
      code := substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
              substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
              substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
              substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
              to_char(extract(epoch from now())::integer, 'FM99999999');
      code := substr(code, 1, 12);
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Update existing users' referral codes to remove special characters
UPDATE users 
SET referral_code = (
  SELECT generate_referral_code(id)
)
WHERE referral_code IS NULL 
   OR referral_code ~ '[^A-Z0-9]'  -- Contains non-alphanumeric characters
   OR length(referral_code) < 6    -- Too short
   OR length(referral_code) > 12;  -- Too long

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;