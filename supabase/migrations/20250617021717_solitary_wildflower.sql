/*
  # Fix referral link URL to use correct website

  1. Function Updates
    - Update generate_referral_link function to use correct base URL
    - Use the actual deployed website URL instead of hardcoded pump.fun

  2. Data Updates
    - Update existing users' referral links to use correct URL
    - Maintain existing link codes but change the base URL
*/

-- Update the generate_referral_link function to use correct base URL
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
    -- Generate a unique link code using user ID, timestamp, and random component
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

-- Update existing users' referral links to use the correct base URL
-- Extract the existing link codes and rebuild with correct base URL
UPDATE users 
SET referral_link = 'https://imaginative-mooncake-336861.netlify.app/ref/' || 
  CASE 
    WHEN referral_link LIKE 'https://pumped.fun/ref/%' THEN 
      substring(referral_link from 'https://pumped.fun/ref/(.+)')
    WHEN referral_link LIKE '%/ref/%' THEN
      substring(referral_link from '.*/ref/(.+)')
    ELSE
      -- Generate new code if format is unexpected
      substring(encode(digest(id::text || extract(epoch from now())::text, 'sha256'), 'hex') from 1 for 12)
  END
WHERE referral_link IS NOT NULL;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_referral_link(uuid) TO public;