/*
  # Clean up referral link system and ensure alphanumeric codes

  1. Database Cleanup
    - Remove referral_link column from users table
    - Remove all referral link related tables and functions
    - Update referral system to use codes only
    - Ensure all referral codes are alphanumeric

  2. Function Updates
    - Remove all referral link functions
    - Update referral tracking to use codes only
    - Ensure code generation is purely alphanumeric

  3. Data Cleanup
    - Remove referral link data
    - Update existing referral codes to be alphanumeric
*/

-- Drop referral link column from users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE users DROP COLUMN referral_link;
  END IF;
END $$;

-- Drop referral link related tables
DROP TABLE IF EXISTS referral_clicks CASCADE;
DROP TABLE IF EXISTS referral_statistics CASCADE;

-- Update referrals table to remove referral_link column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE referrals DROP COLUMN referral_link;
  END IF;
END $$;

-- Drop all referral link related functions
DROP FUNCTION IF EXISTS generate_referral_link(uuid);
DROP FUNCTION IF EXISTS track_referral_click(text, inet, text);
DROP FUNCTION IF EXISTS process_referral_from_link(text, uuid);
DROP FUNCTION IF EXISTS get_referral_statistics(uuid);
DROP FUNCTION IF EXISTS expire_old_referrals();

-- Update the user trigger function to only handle referral codes
CREATE OR REPLACE FUNCTION set_user_referral_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always generate a new referral code (alphanumeric only)
  NEW.referral_code := generate_referral_code(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create a simple referral click tracking function for codes only
CREATE OR REPLACE FUNCTION track_referral_click(
  referral_code_param text,
  ip_address_param inet DEFAULT NULL,
  user_agent_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id uuid;
  click_id uuid;
BEGIN
  -- Find the referrer by referral code
  SELECT id INTO referrer_user_id
  FROM users 
  WHERE referral_code = UPPER(referral_code_param);
  
  IF referrer_user_id IS NOT NULL THEN
    -- For now, just return a dummy UUID since we're not tracking clicks in detail
    RETURN gen_random_uuid();
  END IF;
  
  RETURN NULL;
END;
$$;

-- Ensure all existing referral codes are clean alphanumeric
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL 
   OR referral_code ~ '[^A-Z0-9]'  -- Contains non-alphanumeric characters
   OR length(referral_code) < 6    -- Too short
   OR length(referral_code) > 12;  -- Too long

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_user_referral_data() TO public;
GRANT EXECUTE ON FUNCTION track_referral_click(text, inet, text) TO public;