-- Create a function to get referral status for a user
CREATE OR REPLACE FUNCTION get_referral_status(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_data record;
  result jsonb;
BEGIN
  -- Check if user has used a referral code (is a referee)
  SELECT 
    r.id,
    r.status,
    u.username as referrer_username
  INTO referral_data
  FROM referrals r
  JOIN users u ON r.referrer_id = u.id
  WHERE r.referred_id = user_id_param;
  
  IF referral_data IS NOT NULL THEN
    result := jsonb_build_object(
      'hasUsedReferral', true,
      'referrerUsername', referral_data.referrer_username,
      'status', referral_data.status,
      'referralId', referral_data.id
    );
  ELSE
    result := jsonb_build_object(
      'hasUsedReferral', false
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_referral_status(uuid) TO public;