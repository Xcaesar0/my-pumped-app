/*
  # Fix referral link generation and update existing links

  1. Function Updates
    - Update generate_referral_link function to use correct production URL
    - Fix the base URL to match the deployed Netlify site

  2. Data Updates
    - Update all existing users' referral links to use correct URL
    - Ensure referral codes are properly formatted
*/

-- Update the generate_referral_link function to use correct production URL
CREATE OR REPLACE FUNCTION generate_referral_link(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_url text := 'https://imaginative-mooncake-336861.netlify.app/ref/';
  link_code text;
  full_link text;
  attempt_count integer := 0;
  max_attempts integer := 10;
BEGIN
  LOOP
    -- Generate a unique link code using user ID and timestamp
    link_code := encode(
      digest(
        user_id_param::text || 
        extract(epoch from now())::text || 
        random()::text || 
        attempt_count::text, 
        'sha256'
      ), 
      'hex'
    );
    link_code := substring(link_code from 1 for 12); -- Use first 12 characters
    
    -- Create full referral link
    full_link := base_url || link_code;
    
    -- Check if this link already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_link = full_link) THEN
      RETURN full_link;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral link after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Update all existing users' referral links to use the correct production URL
UPDATE users 
SET referral_link = 'https://imaginative-mooncake-336861.netlify.app/ref/' || 
  CASE 
    WHEN referral_link LIKE '%/ref/%' THEN 
      substring(referral_link from '.*/ref/(.+)')
    WHEN referral_code IS NOT NULL THEN
      referral_code
    ELSE
      -- Generate new code if neither exists
      substring(encode(digest(id::text || extract(epoch from now())::text, 'sha256'), 'hex') from 1 for 12)
  END
WHERE referral_link IS NULL OR referral_link NOT LIKE 'https://imaginative-mooncake-336861.netlify.app/ref/%';

-- Ensure all users have referral codes
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_referral_link(uuid) TO public;