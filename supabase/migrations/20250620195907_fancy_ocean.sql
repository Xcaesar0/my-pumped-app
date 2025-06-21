/*
  # Remove referral link functionality

  1. Changes
    - Remove referral_link column from users table
    - Remove referral_link column from referrals table (if exists)
    - Update referral_clicks table to use referral_code instead of referral_link (if table exists)
    - Replace referral link functions with referral code functions

  2. Security
    - Maintains existing RLS policies
    - No changes to authentication or permissions
*/

-- Remove referral_link column from users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE users DROP COLUMN referral_link;
  END IF;
END $$;

-- Remove referral_link column from referrals table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE referrals DROP COLUMN referral_link;
  END IF;
END $$;

-- Update referral_clicks table only if it exists
DO $$
BEGIN
  -- Check if referral_clicks table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'referral_clicks'
  ) THEN
    -- Add referral_code column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'referral_clicks' AND column_name = 'referral_code'
    ) THEN
      ALTER TABLE referral_clicks ADD COLUMN referral_code text;
    END IF;

    -- Remove referral_link column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'referral_clicks' AND column_name = 'referral_link'
    ) THEN
      ALTER TABLE referral_clicks DROP COLUMN referral_link;
    END IF;
  END IF;
END $$;

-- Drop ALL existing functions that might conflict
DROP FUNCTION IF EXISTS process_referral_from_link(text, uuid);
DROP FUNCTION IF EXISTS process_referral_from_code(text, uuid);
DROP FUNCTION IF EXISTS track_referral_click(text, text, text);
DROP FUNCTION IF EXISTS track_referral_click(text);

-- Create new function to process referral from code
CREATE OR REPLACE FUNCTION process_referral_from_code(
  referral_code_param text,
  new_user_id_param uuid
) RETURNS void AS $$
DECLARE
  referrer_user_id uuid;
BEGIN
  -- Find the referrer by referral code
  SELECT id INTO referrer_user_id
  FROM users
  WHERE referral_code = referral_code_param;

  -- If referrer found and it's not the same user
  IF referrer_user_id IS NOT NULL AND referrer_user_id != new_user_id_param THEN
    -- Create the referral relationship
    INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
    VALUES (referrer_user_id, new_user_id_param, referral_code_param, 'pending')
    ON CONFLICT (referrer_id, referred_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create new function to track referral clicks using codes (only if referral_clicks table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'referral_clicks'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION track_referral_click(
      referral_code_param text,
      ip_address_param text DEFAULT NULL,
      user_agent_param text DEFAULT NULL
    ) RETURNS text AS $func$
    DECLARE
      click_id uuid;
      referrer_user_id uuid;
    BEGIN
      -- Find the referrer by referral code
      SELECT id INTO referrer_user_id
      FROM users
      WHERE referral_code = referral_code_param;

      -- Insert the click record
      INSERT INTO referral_clicks (
        referral_code,
        referrer_id,
        ip_address,
        user_agent,
        clicked_at,
        converted
      ) VALUES (
        referral_code_param,
        referrer_user_id,
        ip_address_param,
        user_agent_param,
        now(),
        false
      ) RETURNING id INTO click_id;

      RETURN click_id::text;
    END;
    $func$ LANGUAGE plpgsql;';
  ELSE
    -- Create a simple version that doesn''t use referral_clicks table
    EXECUTE '
    CREATE OR REPLACE FUNCTION track_referral_click(
      referral_code_param text,
      ip_address_param text DEFAULT NULL,
      user_agent_param text DEFAULT NULL
    ) RETURNS text AS $func$
    BEGIN
      -- Return a dummy ID since referral_clicks table doesn''t exist
      RETURN gen_random_uuid()::text;
    END;
    $func$ LANGUAGE plpgsql;';
  END IF;
END $$;