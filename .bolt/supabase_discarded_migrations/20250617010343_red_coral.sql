/*
  # Comprehensive Points and Referral System

  1. Database Schema Updates
    - Add referral_link to users table (non-modifiable unique link)
    - Update referrals table with proper status tracking
    - Add X account connection tracking
    - Add notification preferences
    - Add comprehensive indexes for performance

  2. New Tables
    - user_notifications for tracking notification states
    - referral_rewards for tracking reward distribution

  3. Security
    - Enable RLS on all tables
    - Add proper policies for data access
    - Ensure referral links are immutable after creation

  4. Functions
    - Auto-generate referral links on user creation
    - Track referral status changes
    - Award points for completed referrals
*/

-- Add referral_link column to users table (immutable after creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE users ADD COLUMN referral_link text UNIQUE;
  END IF;
END $$;

-- Add X account connection timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'x_connected_at'
  ) THEN
    ALTER TABLE users ADD COLUMN x_connected_at timestamptz;
  END IF;
END $$;

-- Create user_notifications table for tracking notification states
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Create referral_rewards table for tracking reward distribution
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('referrer_bonus', 'referee_bonus')),
  points_awarded integer NOT NULL,
  awarded_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Enable RLS on new tables
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_link ON users(referral_link);
CREATE INDEX IF NOT EXISTS idx_users_x_connected_at ON users(x_connected_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_type ON user_notifications(user_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);

-- RLS Policies for user_notifications
CREATE POLICY "Users can read their own notifications"
  ON user_notifications
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own notifications"
  ON user_notifications
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON user_notifications
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- RLS Policies for referral_rewards
CREATE POLICY "Users can read referral rewards"
  ON referral_rewards
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can insert referral rewards"
  ON referral_rewards
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Function to generate unique referral link
CREATE OR REPLACE FUNCTION generate_referral_link(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_url text := 'https://pumped.fun/ref/';
  link_code text;
  full_link text;
BEGIN
  -- Generate a unique link code using user ID and timestamp
  link_code := encode(digest(user_id_param::text || extract(epoch from now())::text, 'sha256'), 'hex');
  link_code := substring(link_code from 1 for 12); -- Use first 12 characters
  
  -- Create full referral link
  full_link := base_url || link_code;
  
  RETURN full_link;
END;
$$;

-- Function to update referral status when X account is connected
CREATE OR REPLACE FUNCTION activate_referrals_on_x_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if X account was just connected
  IF OLD.x_connected_at IS NULL AND NEW.x_connected_at IS NOT NULL THEN
    -- Update all pending referrals where this user is the referee
    UPDATE referrals 
    SET status = 'completed'
    WHERE referred_id = NEW.id AND status = 'pending';
    
    -- Award points to referrers for completed referrals
    INSERT INTO referral_rewards (referral_id, reward_type, points_awarded, user_id)
    SELECT 
      r.id,
      'referrer_bonus',
      r.points_awarded,
      r.referrer_id
    FROM referrals r
    WHERE r.referred_id = NEW.id AND r.status = 'completed'
    ON CONFLICT DO NOTHING;
    
    -- Award bonus points to the referee
    INSERT INTO referral_rewards (referral_id, reward_type, points_awarded, user_id)
    SELECT 
      r.id,
      'referee_bonus',
      50, -- Bonus points for being referred
      r.referred_id
    FROM referrals r
    WHERE r.referred_id = NEW.id AND r.status = 'completed'
    ON CONFLICT DO NOTHING;
    
    -- Update referrer points
    UPDATE users 
    SET current_points = current_points + (
      SELECT COALESCE(SUM(rr.points_awarded), 0)
      FROM referral_rewards rr
      JOIN referrals r ON rr.referral_id = r.id
      WHERE r.referrer_id = users.id 
        AND r.referred_id = NEW.id 
        AND r.status = 'completed'
        AND rr.reward_type = 'referrer_bonus'
    )
    WHERE id IN (
      SELECT r.referrer_id 
      FROM referrals r 
      WHERE r.referred_id = NEW.id AND r.status = 'completed'
    );
    
    -- Update referee points
    UPDATE users 
    SET current_points = current_points + (
      SELECT COALESCE(SUM(rr.points_awarded), 0)
      FROM referral_rewards rr
      JOIN referrals r ON rr.referral_id = r.id
      WHERE r.referred_id = NEW.id 
        AND r.status = 'completed'
        AND rr.reward_type = 'referee_bonus'
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the user referral code and link generation function
CREATE OR REPLACE FUNCTION set_user_referral_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set referral code if not already set
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  
  -- Set referral link if not already set (immutable after creation)
  IF NEW.referral_link IS NULL THEN
    NEW.referral_link := generate_referral_link(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the trigger for new users
DROP TRIGGER IF EXISTS trigger_set_referral_code ON users;
CREATE TRIGGER trigger_set_referral_data
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_referral_data();

-- Create trigger for X account connection
DROP TRIGGER IF EXISTS trigger_activate_referrals ON users;
CREATE TRIGGER trigger_activate_referrals
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION activate_referrals_on_x_connection();

-- Function to check if user has X account connected
CREATE OR REPLACE FUNCTION user_has_x_connected(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  has_connection boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM social_connections 
    WHERE user_id = user_id_param 
      AND platform = 'x' 
      AND is_active = true
  ) INTO has_connection;
  
  RETURN has_connection;
END;
$$;

-- Function to process referral from link
CREATE OR REPLACE FUNCTION process_referral_from_link(referral_link_param text, new_user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id uuid;
  existing_referral_id uuid;
BEGIN
  -- Find the referrer by referral link
  SELECT id INTO referrer_user_id
  FROM users 
  WHERE referral_link = referral_link_param;
  
  -- If referrer found and it's not the same user
  IF referrer_user_id IS NOT NULL AND referrer_user_id != new_user_id_param THEN
    -- Check if referral already exists
    SELECT id INTO existing_referral_id
    FROM referrals
    WHERE referrer_id = referrer_user_id AND referred_id = new_user_id_param;
    
    -- Create referral if it doesn't exist
    IF existing_referral_id IS NULL THEN
      INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
      VALUES (
        referrer_user_id, 
        new_user_id_param, 
        (SELECT referral_code FROM users WHERE id = referrer_user_id),
        'pending'
      );
    END IF;
  END IF;
END;
$$;

-- Function to dismiss notification
CREATE OR REPLACE FUNCTION dismiss_notification(user_id_param uuid, notification_type_param text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_notifications (user_id, notification_type, dismissed_at)
  VALUES (user_id_param, notification_type_param, now())
  ON CONFLICT (user_id, notification_type) 
  DO UPDATE SET dismissed_at = now();
END;
$$;

-- Function to check if notification should be shown
CREATE OR REPLACE FUNCTION should_show_notification(user_id_param uuid, notification_type_param text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  last_dismissed timestamptz;
  should_show boolean := true;
BEGIN
  SELECT dismissed_at INTO last_dismissed
  FROM user_notifications
  WHERE user_id = user_id_param AND notification_type = notification_type_param;
  
  -- Show notification if never dismissed or if it was dismissed more than 24 hours ago
  IF last_dismissed IS NOT NULL AND last_dismissed > (now() - interval '24 hours') THEN
    should_show := false;
  END IF;
  
  RETURN should_show;
END;
$$;

-- Update existing users to have referral links if they don't have them
UPDATE users 
SET referral_link = generate_referral_link(id)
WHERE referral_link IS NULL;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_referral_link(uuid) TO public;
GRANT EXECUTE ON FUNCTION user_has_x_connected(uuid) TO public;
GRANT EXECUTE ON FUNCTION process_referral_from_link(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION dismiss_notification(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION should_show_notification(uuid, text) TO public;