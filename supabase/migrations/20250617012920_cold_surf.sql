/*
  # Fix referrals table INSERT policy

  1. Security Changes
    - Drop the existing overly restrictive INSERT policy on referrals table
    - Create a new INSERT policy that allows users to create referral records where they are the referred user
    - This ensures users can only create referrals where they are being referred (not where they are the referrer)

  2. Policy Details
    - Policy name: "Users can create referrals where they are referred"
    - Condition: Only allow INSERT when the authenticated user's ID matches the referred_id
    - This prevents users from creating fake referrals for others while allowing legitimate referral creation
*/

-- Drop the existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Users can insert referrals" ON referrals;

-- Create a new INSERT policy that allows users to create referrals where they are the referred user
CREATE POLICY "Users can create referrals where they are referred"
  ON referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_id);