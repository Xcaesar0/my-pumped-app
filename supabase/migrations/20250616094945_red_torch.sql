/*
  # Add get_top_referrers RPC function

  1. New Functions
    - `get_top_referrers(limit_count)` - Returns top referrers with their referral counts and ranks
      - Takes a limit parameter to control how many results to return
      - Returns username, referrals count, and rank for each user
      - Only counts completed referrals
      - Orders by referral count descending, then by username for consistent ordering

  2. Security
    - Function is accessible to public role (same as existing table policies)
    - Uses existing table structure and relationships
*/

CREATE OR REPLACE FUNCTION public.get_top_referrers(limit_count integer)
 RETURNS TABLE(username text, referrals bigint, rank bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.username,
    COUNT(r.id) AS referrals,
    RANK() OVER (ORDER BY COUNT(r.id) DESC) AS rank
  FROM
    public.users u
  JOIN
    public.referrals r ON u.id = r.referrer_id
  WHERE
    r.status = 'completed'
  GROUP BY
    u.id, u.username
  ORDER BY
    referrals DESC, u.username ASC
  LIMIT limit_count;
END;
$function$;

-- Grant execute permission to public role
GRANT EXECUTE ON FUNCTION public.get_top_referrers(integer) TO public;