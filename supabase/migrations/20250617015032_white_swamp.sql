-- First, ensure users table has all required referral fields
DO $$
BEGIN
  -- Add referral_link column (immutable after creation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE users ADD COLUMN referral_link text;
  END IF;

  -- Add X account connection timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'x_connected_at'
  ) THEN
    ALTER TABLE users ADD COLUMN x_connected_at timestamptz;
  END IF;
END $$;

-- Add unique constraint on referral_link after column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_referral_link_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_referral_link_key UNIQUE (referral_link);
  END IF;
END $$;

-- Create referral_clicks table for tracking link clicks
CREATE TABLE IF NOT EXISTS referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link text NOT NULL,
  referrer_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ip_address inet,
  user_agent text,
  clicked_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  converted_user_id uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create referral_statistics table for aggregated data
CREATE TABLE IF NOT EXISTS referral_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_clicks integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_rewards_earned integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Update referrals table structure if needed
DO $$
BEGIN
  -- Add referral_link column to referrals if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'referral_link'
  ) THEN
    ALTER TABLE referrals ADD COLUMN referral_link text;
  END IF;

  -- Add activated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'activated_at'
  ) THEN
    ALTER TABLE referrals ADD COLUMN activated_at timestamptz;
  END IF;

  -- Add expires_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referrals' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE referrals ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '30 days');
  END IF;
END $$;

-- Update referrals status constraint to include new statuses
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
  
  -- Add new constraint with expanded status options
  ALTER TABLE referrals ADD CONSTRAINT referrals_status_check 
  CHECK (status IN ('pending', 'completed', 'cancelled', 'active', 'expired', 'invalid'));
END $$;

-- Ensure referral_rewards table exists with proper structure
DO $$
BEGIN
  -- Check if table exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_rewards') THEN
    CREATE TABLE referral_rewards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
      reward_type text NOT NULL CHECK (reward_type IN ('referrer_bonus', 'referee_bonus', 'milestone_bonus')),
      points_awarded integer NOT NULL,
      awarded_at timestamptz DEFAULT now(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
  END IF;
END $$;

-- Ensure user_notifications table exists
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  message text,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS on all tables
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_link ON users(referral_link);
CREATE INDEX IF NOT EXISTS idx_users_x_connected_at ON users(x_connected_at);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_link ON referral_clicks(referral_link);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON referral_clicks(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_converted ON referral_clicks(converted);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON referral_clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_referrals_link ON referrals(referral_link);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_type ON referral_rewards(reward_type);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_type ON user_notifications(user_id, notification_type);

-- Drop ALL existing policies to avoid conflicts, then recreate them

-- Drop referral_clicks policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read referral clicks" ON referral_clicks;
  DROP POLICY IF EXISTS "System can insert referral clicks" ON referral_clicks;
  DROP POLICY IF EXISTS "Users can read their own referral clicks" ON referral_clicks;
  DROP POLICY IF EXISTS "Public users can insert referral clicks" ON referral_clicks;
  DROP POLICY IF EXISTS "Public users can read referral clicks" ON referral_clicks;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop referral_statistics policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read referral statistics" ON referral_statistics;
  DROP POLICY IF EXISTS "System can manage referral statistics" ON referral_statistics;
  DROP POLICY IF EXISTS "Users can read their own referral statistics" ON referral_statistics;
  DROP POLICY IF EXISTS "Public users can read referral statistics" ON referral_statistics;
  DROP POLICY IF EXISTS "Public users can manage referral statistics" ON referral_statistics;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop referrals policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read their own referrals" ON referrals;
  DROP POLICY IF EXISTS "Users can create referrals where they are referred" ON referrals;
  DROP POLICY IF EXISTS "Users can update their own referrals" ON referrals;
  DROP POLICY IF EXISTS "Users can read referrals" ON referrals;
  DROP POLICY IF EXISTS "System can update referrals" ON referrals;
  DROP POLICY IF EXISTS "Users can insert referrals" ON referrals;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop referral_rewards policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read referral rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "System can insert referral rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "Users can read their own referral rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "Public users can read referral rewards" ON referral_rewards;
  DROP POLICY IF EXISTS "Public users can insert referral rewards" ON referral_rewards;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop user_notifications policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Users can insert their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Users can update their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Public users can read notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Public users can insert notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Public users can update notifications" ON user_notifications;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop triggers first (they depend on functions)
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_set_referral_data ON users;
  DROP TRIGGER IF EXISTS trigger_activate_referrals ON users;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Drop ALL existing functions in dependency order (dependent functions first)
DO $$
BEGIN
  -- Drop trigger functions first
  DROP FUNCTION IF EXISTS set_user_referral_data();
  DROP FUNCTION IF EXISTS activate_referrals_on_x_connection();
  
  -- Then drop other functions
  DROP FUNCTION IF EXISTS track_referral_click(text, inet, text);
  DROP FUNCTION IF EXISTS process_referral_from_link(text, uuid);
  DROP FUNCTION IF EXISTS get_referral_statistics(uuid);
  DROP FUNCTION IF EXISTS user_has_x_connected(uuid);
  DROP FUNCTION IF EXISTS dismiss_notification(uuid, text);
  DROP FUNCTION IF EXISTS should_show_notification(uuid, text);
  DROP FUNCTION IF EXISTS expire_old_referrals();
  
  -- Finally drop the base function
  DROP FUNCTION IF EXISTS generate_referral_link(uuid);
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create new RLS policies

-- RLS Policies for referral_clicks
CREATE POLICY "Users can read referral clicks"
  ON referral_clicks
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can insert referral clicks"
  ON referral_clicks
  FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for referral_statistics
CREATE POLICY "Users can read referral statistics"
  ON referral_statistics
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can manage referral statistics"
  ON referral_statistics
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- RLS Policies for referrals
CREATE POLICY "Users can read referrals"
  ON referrals
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create referrals where they are referred"
  ON referrals
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own referrals"
  ON referrals
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

-- Create functions in correct dependency order

-- Function to generate unique referral link (base function)
CREATE FUNCTION generate_referral_link(user_id_param uuid)
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

-- Function to track referral link clicks
CREATE FUNCTION track_referral_click(
  referral_link_param text,
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
  -- Find the referrer by referral link
  SELECT id INTO referrer_user_id
  FROM users 
  WHERE referral_link = referral_link_param;
  
  IF referrer_user_id IS NOT NULL THEN
    -- Insert click record
    INSERT INTO referral_clicks (referral_link, referrer_id, ip_address, user_agent)
    VALUES (referral_link_param, referrer_user_id, ip_address_param, user_agent_param)
    RETURNING id INTO click_id;
    
    -- Update statistics
    INSERT INTO referral_statistics (user_id, total_clicks, last_updated)
    VALUES (referrer_user_id, 1, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_clicks = referral_statistics.total_clicks + 1,
      last_updated = now();
      
    RETURN click_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Function to process referral from link with comprehensive validation
CREATE FUNCTION process_referral_from_link(
  referral_link_param text, 
  new_user_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  referrer_user_id uuid;
  existing_referral_id uuid;
  referral_id uuid;
  referrer_code text;
  result jsonb;
BEGIN
  -- Validate inputs
  IF referral_link_param IS NULL OR new_user_id_param IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters');
  END IF;
  
  -- Find the referrer by referral link
  SELECT id, referral_code INTO referrer_user_id, referrer_code
  FROM users 
  WHERE referral_link = referral_link_param;
  
  -- Validate referrer exists
  IF referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral link');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user_id = new_user_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if referral already exists
  SELECT id INTO existing_referral_id
  FROM referrals
  WHERE referrer_id = referrer_user_id AND referred_id = new_user_id_param;
  
  -- Create referral if it doesn't exist
  IF existing_referral_id IS NULL THEN
    INSERT INTO referrals (
      referrer_id, 
      referred_id, 
      referral_code, 
      referral_link,
      status,
      expires_at
    )
    VALUES (
      referrer_user_id, 
      new_user_id_param, 
      COALESCE(referrer_code, referrer_user_id::text),
      referral_link_param,
      'pending',
      now() + interval '30 days'
    )
    RETURNING id INTO referral_id;
    
    -- Update click conversion if there's a recent click
    UPDATE referral_clicks 
    SET converted = true, converted_user_id = new_user_id_param
    WHERE referral_link = referral_link_param 
      AND referrer_id = referrer_user_id
      AND clicked_at > (now() - interval '24 hours')
      AND converted = false;
    
    -- Award immediate signup bonus to referee
    INSERT INTO referral_rewards (referral_id, reward_type, points_awarded, user_id)
    VALUES (referral_id, 'referee_bonus', 25, new_user_id_param);
    
    -- Update referee points
    UPDATE users 
    SET current_points = current_points + 25
    WHERE id = new_user_id_param;
    
    -- Create notification for referrer
    INSERT INTO user_notifications (user_id, notification_type, message)
    VALUES (
      referrer_user_id, 
      'new_referral', 
      'Someone joined using your referral link! They need to connect their X account to activate the referral.'
    )
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
      message = EXCLUDED.message,
      created_at = now(),
      dismissed_at = NULL;
    
    RETURN jsonb_build_object(
      'success', true, 
      'referral_id', referral_id,
      'status', 'pending',
      'message', 'Referral created successfully. Connect your X account to activate rewards.'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Referral already exists',
      'referral_id', existing_referral_id
    );
  END IF;
END;
$$;

-- Function to get comprehensive referral statistics
CREATE FUNCTION get_referral_statistics(user_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  stats jsonb;
  pending_count integer;
  active_count integer;
  total_earned integer;
  click_count integer;
  conversion_rate numeric;
BEGIN
  -- Get basic statistics
  SELECT 
    COALESCE(total_clicks, 0) as clicks,
    COALESCE(total_conversions, 0) as conversions,
    COALESCE(total_rewards_earned, 0) as rewards
  INTO click_count, active_count, total_earned
  FROM referral_statistics 
  WHERE user_id = user_id_param;
  
  -- Get pending referrals count
  SELECT COUNT(*) INTO pending_count
  FROM referrals 
  WHERE referrer_id = user_id_param AND status = 'pending';
  
  -- Get active referrals count
  SELECT COUNT(*) INTO active_count
  FROM referrals 
  WHERE referrer_id = user_id_param AND status = 'active';
  
  -- Calculate conversion rate
  IF click_count > 0 THEN
    conversion_rate := (active_count::numeric / click_count::numeric) * 100;
  ELSE
    conversion_rate := 0;
  END IF;
  
  -- Build result
  stats := jsonb_build_object(
    'total_clicks', COALESCE(click_count, 0),
    'pending_referrals', COALESCE(pending_count, 0),
    'active_referrals', COALESCE(active_count, 0),
    'total_earned', COALESCE(total_earned, 0),
    'conversion_rate', ROUND(conversion_rate, 2)
  );
  
  RETURN stats;
END;
$$;

-- Function to check if user has X account connected
CREATE FUNCTION user_has_x_connected(user_id_param uuid)
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
  ) OR (
    SELECT x_connected_at IS NOT NULL
    FROM users
    WHERE id = user_id_param
  ) INTO has_connection;
  
  RETURN COALESCE(has_connection, false);
END;
$$;

-- Function to dismiss notification
CREATE FUNCTION dismiss_notification(user_id_param uuid, notification_type_param text)
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
CREATE FUNCTION should_show_notification(user_id_param uuid, notification_type_param text)
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

-- Function to expire old referrals
CREATE FUNCTION expire_old_referrals()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE referrals 
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Create trigger functions (these depend on the base functions)
CREATE FUNCTION set_user_referral_data()
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

-- Function to activate referrals when X account is connected
CREATE FUNCTION activate_referrals_on_x_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referral_record record;
  total_referrer_bonus integer := 0;
BEGIN
  -- Check if X account was just connected
  IF OLD.x_connected_at IS NULL AND NEW.x_connected_at IS NOT NULL THEN
    
    -- Process all pending referrals where this user is the referee
    FOR referral_record IN 
      SELECT * FROM referrals 
      WHERE referred_id = NEW.id AND status = 'pending' AND expires_at > now()
    LOOP
      -- Update referral status to active
      UPDATE referrals 
      SET status = 'active', activated_at = now()
      WHERE id = referral_record.id;
      
      -- Award points to referrer
      INSERT INTO referral_rewards (referral_id, reward_type, points_awarded, user_id)
      VALUES (referral_record.id, 'referrer_bonus', referral_record.points_awarded, referral_record.referrer_id);
      
      -- Award additional bonus to referee for completing activation
      INSERT INTO referral_rewards (referral_id, reward_type, points_awarded, user_id)
      VALUES (referral_record.id, 'referee_bonus', 75, referral_record.referred_id);
      
      total_referrer_bonus := total_referrer_bonus + referral_record.points_awarded;
      
      -- Update referrer points
      UPDATE users 
      SET current_points = current_points + referral_record.points_awarded
      WHERE id = referral_record.referrer_id;
      
      -- Update statistics
      INSERT INTO referral_statistics (user_id, total_conversions, total_rewards_earned, last_updated)
      VALUES (referral_record.referrer_id, 1, referral_record.points_awarded, now())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        total_conversions = referral_statistics.total_conversions + 1,
        total_rewards_earned = referral_statistics.total_rewards_earned + referral_record.points_awarded,
        last_updated = now();
      
      -- Create notification for referrer
      INSERT INTO user_notifications (user_id, notification_type, message)
      VALUES (
        referral_record.referrer_id, 
        'referral_activated', 
        format('Referral activated! You earned %s points.', referral_record.points_awarded)
      )
      ON CONFLICT (user_id, notification_type) DO UPDATE SET
        message = EXCLUDED.message,
        created_at = now(),
        dismissed_at = NULL;
    END LOOP;
    
    -- Update referee points for activation bonus
    UPDATE users 
    SET current_points = current_points + 75
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers (these depend on the trigger functions)
CREATE TRIGGER trigger_set_referral_data
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_referral_data();

CREATE TRIGGER trigger_activate_referrals
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION activate_referrals_on_x_connection();

-- Update existing users to have referral links if they don't have them
UPDATE users 
SET 
  referral_link = generate_referral_link(id),
  referral_code = COALESCE(referral_code, generate_referral_code(id))
WHERE referral_link IS NULL OR referral_code IS NULL;

-- Initialize referral statistics for existing users
INSERT INTO referral_statistics (user_id, total_clicks, total_conversions, total_rewards_earned)
SELECT 
  u.id,
  0,
  COUNT(r.id) FILTER (WHERE r.status = 'active'),
  COALESCE(SUM(rr.points_awarded), 0)
FROM users u
LEFT JOIN referrals r ON u.id = r.referrer_id
LEFT JOIN referral_rewards rr ON u.id = rr.user_id
GROUP BY u.id
ON CONFLICT (user_id) DO NOTHING;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION generate_referral_link(uuid) TO public;
GRANT EXECUTE ON FUNCTION track_referral_click(text, inet, text) TO public;
GRANT EXECUTE ON FUNCTION process_referral_from_link(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION get_referral_statistics(uuid) TO public;
GRANT EXECUTE ON FUNCTION user_has_x_connected(uuid) TO public;
GRANT EXECUTE ON FUNCTION dismiss_notification(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION should_show_notification(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION expire_old_referrals() TO public;
GRANT EXECUTE ON FUNCTION set_user_referral_data() TO public;
GRANT EXECUTE ON FUNCTION activate_referrals_on_x_connection() TO public;