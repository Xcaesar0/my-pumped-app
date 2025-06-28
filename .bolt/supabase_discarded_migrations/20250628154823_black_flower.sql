/*
  # Create Missing Database Components
  
  This migration creates only the components that are missing from the current database
  based on what the application expects to exist.

  1. Tables
    - Ensure all required tables exist with proper structure
    - Add missing columns to existing tables
    - Create indexes for performance

  2. Functions
    - Create essential functions for referral processing
    - Create user management functions
    - Create point award functions

  3. Security
    - Enable RLS on all tables
    - Create appropriate policies for public access
*/

-- =============================================
-- STEP 1: Ensure core tables exist
-- =============================================

-- Users table (core table)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  username text NOT NULL,
  connection_timestamp timestamptz DEFAULT now(),
  current_points integer DEFAULT 0,
  current_rank integer DEFAULT 0,
  referral_code text UNIQUE,
  is_active boolean DEFAULT true,
  kinde_user_id text,
  points integer DEFAULT 0,
  x_connected_at timestamptz
);

-- Social connections table
CREATE TABLE IF NOT EXISTS social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('telegram', 'x')),
  platform_user_id text NOT NULL,
  platform_username text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  auth_provider text,
  kinde_connection_id text,
  provider_metadata jsonb,
  user_data jsonb,
  UNIQUE(user_id, platform)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  points_awarded integer DEFAULT 100,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'active', 'expired', 'invalid')),
  activated_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  UNIQUE(referrer_id, referred_id)
);

-- User tasks table
CREATE TABLE IF NOT EXISTS user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN ('invite_1', 'invite_5', 'invite_10', 'invite_50', 'invite_100')),
  task_target integer NOT NULL,
  current_progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_type)
);

-- User notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  message text,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Referral tracking table (enhanced)
CREATE TABLE IF NOT EXISTS referral_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  code_entry_points_awarded boolean DEFAULT false,
  first_social_points_awarded boolean DEFAULT false,
  second_social_points_awarded boolean DEFAULT false,
  chain_continuation_points_awarded boolean DEFAULT false,
  twitter_connected boolean DEFAULT false,
  telegram_connected boolean DEFAULT false,
  twitter_connected_at timestamptz,
  telegram_connected_at timestamptz,
  has_referred_someone boolean DEFAULT false,
  chain_continued_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(referrer_id, referee_id)
);

-- Point awards table
CREATE TABLE IF NOT EXISTS point_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  award_type text NOT NULL CHECK (award_type IN (
    'referral_code_entry_referrer',
    'referral_code_entry_referee', 
    'first_social_connection_referrer',
    'second_social_connection_referrer',
    'chain_continuation_referrer',
    'twitter_connection_referee',
    'telegram_connection_referee',
    'self_referral_referee'
  )),
  points_awarded integer NOT NULL,
  reference_id uuid,
  reference_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Points transactions table
CREATE TABLE IF NOT EXISTS points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_bonus', 'social_linking', 'task_completion', 'manual_adjustment')),
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

-- X task completions table
CREATE TABLE IF NOT EXISTS x_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  x_username text NOT NULL,
  task_title text NOT NULL,
  completed_at timestamptz DEFAULT now()
);

-- =============================================
-- STEP 2: Add missing columns to existing tables
-- =============================================

-- Add missing columns to users table
DO $$
BEGIN
  -- Add referral_code if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referral_code') THEN
    ALTER TABLE users ADD COLUMN referral_code text UNIQUE;
  END IF;
  
  -- Add is_active if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  -- Add kinde_user_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kinde_user_id') THEN
    ALTER TABLE users ADD COLUMN kinde_user_id text;
  END IF;
  
  -- Add points if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'points') THEN
    ALTER TABLE users ADD COLUMN points integer DEFAULT 0;
  END IF;
  
  -- Add x_connected_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'x_connected_at') THEN
    ALTER TABLE users ADD COLUMN x_connected_at timestamptz;
  END IF;
END $$;

-- Add missing columns to social_connections table
DO $$
BEGIN
  -- Add user_data if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_connections' AND column_name = 'user_data') THEN
    ALTER TABLE social_connections ADD COLUMN user_data jsonb;
  END IF;
END $$;

-- Add missing columns to referrals table
DO $$
BEGIN
  -- Add activated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'activated_at') THEN
    ALTER TABLE referrals ADD COLUMN activated_at timestamptz;
  END IF;
  
  -- Add expires_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'expires_at') THEN
    ALTER TABLE referrals ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '30 days');
  END IF;
END $$;

-- Add missing columns to user_notifications table
DO $$
BEGIN
  -- Add message if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'message') THEN
    ALTER TABLE user_notifications ADD COLUMN message text;
  END IF;
END $$;

-- =============================================
-- STEP 3: Enable RLS on all tables
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_task_completions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 4: Create RLS policies for public access
-- =============================================

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
  -- Users policies
  DROP POLICY IF EXISTS "Public can insert user data" ON users;
  DROP POLICY IF EXISTS "Public can read user data" ON users;
  DROP POLICY IF EXISTS "Public can update user data" ON users;
  DROP POLICY IF EXISTS "Users can read all user data" ON users;
  DROP POLICY IF EXISTS "Users can insert their own data" ON users;
  DROP POLICY IF EXISTS "Users can update their own data" ON users;
  
  -- Social connections policies
  DROP POLICY IF EXISTS "Public users can insert social connections" ON social_connections;
  DROP POLICY IF EXISTS "Public users can read social connections" ON social_connections;
  DROP POLICY IF EXISTS "Public users can update social connections" ON social_connections;
  DROP POLICY IF EXISTS "Public users can delete social connections" ON social_connections;
  
  -- Referrals policies
  DROP POLICY IF EXISTS "Public can read referrals" ON referrals;
  DROP POLICY IF EXISTS "Public can create referrals" ON referrals;
  DROP POLICY IF EXISTS "Public can update referrals" ON referrals;
  
  -- Other table policies
  DROP POLICY IF EXISTS "Allow user task creation" ON user_tasks;
  DROP POLICY IF EXISTS "Users can read their own tasks" ON user_tasks;
  DROP POLICY IF EXISTS "Users can update their own tasks" ON user_tasks;
  DROP POLICY IF EXISTS "Users can read their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Users can insert their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Users can update their own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Public can read referral tracking" ON referral_tracking;
  DROP POLICY IF EXISTS "Public can manage referral tracking" ON referral_tracking;
  DROP POLICY IF EXISTS "Public can read point awards" ON point_awards;
  DROP POLICY IF EXISTS "Public can insert point awards" ON point_awards;
  DROP POLICY IF EXISTS "Public can insert point transactions" ON points_transactions;
  DROP POLICY IF EXISTS "Public can read point transactions" ON points_transactions;
  DROP POLICY IF EXISTS "Public can read x task completions" ON x_task_completions;
  DROP POLICY IF EXISTS "Public can insert x task completions" ON x_task_completions;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create new policies for public access
CREATE POLICY "Public can insert user data" ON users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read user data" ON users FOR SELECT TO public USING (true);
CREATE POLICY "Public can update user data" ON users FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can insert social connections" ON social_connections FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read social connections" ON social_connections FOR SELECT TO public USING (true);
CREATE POLICY "Public can update social connections" ON social_connections FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete social connections" ON social_connections FOR DELETE TO public USING (true);

CREATE POLICY "Public can read referrals" ON referrals FOR SELECT TO public USING (true);
CREATE POLICY "Public can create referrals" ON referrals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update referrals" ON referrals FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can create user tasks" ON user_tasks FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read user tasks" ON user_tasks FOR SELECT TO public USING (true);
CREATE POLICY "Public can update user tasks" ON user_tasks FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can read user notifications" ON user_notifications FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert user notifications" ON user_notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update user notifications" ON user_notifications FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can read referral tracking" ON referral_tracking FOR SELECT TO public USING (true);
CREATE POLICY "Public can manage referral tracking" ON referral_tracking FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can read point awards" ON point_awards FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert point awards" ON point_awards FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can insert point transactions" ON points_transactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read point transactions" ON points_transactions FOR SELECT TO public USING (true);

CREATE POLICY "Public can read x task completions" ON x_task_completions FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert x task completions" ON x_task_completions FOR INSERT TO public WITH CHECK (true);

-- =============================================
-- STEP 5: Create essential functions
-- =============================================

-- Generate referral code function
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
  attempt integer := 0;
  max_attempts integer := 10;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = result) THEN
      RETURN result;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      result := substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
                substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
                substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
                substr(chars, floor(random() * length(chars) + 1)::integer, 1) ||
                lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
      RETURN substr(result, 1, 8);
    END IF;
  END LOOP;
END;
$$;

-- User creation handler
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Referral code processing function
CREATE OR REPLACE FUNCTION process_referral_code_entry(
  referral_code_param text,
  referee_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_user_id uuid;
  existing_referral_count integer;
  referral_id uuid;
  clean_code text;
BEGIN
  -- Validate inputs
  IF referral_code_param IS NULL OR trim(referral_code_param) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code is required');
  END IF;
  
  IF referee_id_param IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User ID is required');
  END IF;
  
  -- Clean the referral code
  clean_code := upper(trim(referral_code_param));
  clean_code := regexp_replace(clean_code, '[^A-Z0-9]', '', 'g');
  
  -- Validate code format
  IF length(clean_code) < 6 OR length(clean_code) > 12 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code must be 6-12 characters long');
  END IF;
  
  -- Find referrer
  SELECT id INTO referrer_user_id
  FROM users
  WHERE referral_code = clean_code
  AND is_active = true;
  
  IF referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user_id = referee_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if user already has a referral
  SELECT COUNT(*) INTO existing_referral_count
  FROM referrals
  WHERE referred_id = referee_id_param;
  
  IF existing_referral_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Create the referral
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    referral_code,
    status,
    points_awarded,
    expires_at
  ) VALUES (
    referrer_user_id,
    referee_id_param,
    clean_code,
    'pending',
    10,
    now() + interval '30 days'
  ) RETURNING id INTO referral_id;
  
  -- Award immediate points to referee (+25)
  UPDATE users 
  SET current_points = current_points + 25
  WHERE id = referee_id_param;
  
  -- Create points transaction for referee
  INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
  VALUES (
    referee_id_param, 
    25, 
    'referral_bonus', 
    referral_id, 
    'Referral signup bonus'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', referral_id,
    'status', 'pending',
    'message', 'Referral code applied successfully! You earned 25 points. Connect your X account to activate more rewards.'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An error occurred while processing the referral code'
    );
END;
$$;

-- Social connection activation function
CREATE OR REPLACE FUNCTION activate_referrals_on_social_connection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  referral_record record;
BEGIN
  -- Only process if this is a new active X connection
  IF NEW.is_active = true AND NEW.platform = 'x' AND (OLD IS NULL OR OLD.is_active = false) THEN
    
    -- Process all pending referrals where this user is the referee
    FOR referral_record IN 
      SELECT * FROM referrals 
      WHERE referred_id = NEW.user_id
        AND status = 'pending' 
        AND expires_at > now()
    LOOP
      -- Update referral status to active
      UPDATE referrals 
      SET status = 'active', activated_at = now()
      WHERE id = referral_record.id;
      
      -- Award +10 points to referrer
      UPDATE users 
      SET current_points = current_points + 10
      WHERE id = referral_record.referrer_id;
      
      -- Award additional +75 points to referee for completing X connection
      UPDATE users 
      SET current_points = current_points + 75
      WHERE id = referral_record.referred_id;
      
      -- Create points transactions
      INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
      VALUES 
        (referral_record.referrer_id, 10, 'referral_bonus', referral_record.id, 'Referral activation bonus'),
        (referral_record.referred_id, 75, 'social_linking', NEW.id, 'X account connection bonus');
    END LOOP;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in activate_referrals_on_social_connection: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Increment user points function
CREATE OR REPLACE FUNCTION increment_user_points(user_id_param uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users 
  SET current_points = current_points + points_to_add
  WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id_param;
  END IF;
END;
$$;

-- Update task progress function
CREATE OR REPLACE FUNCTION update_task_progress(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  referral_count integer;
  task_record record;
BEGIN
  -- Get current referral count for user
  SELECT COUNT(*) INTO referral_count
  FROM referrals r
  JOIN users u ON r.referred_id = u.id
  JOIN social_connections sc ON u.id = sc.user_id
  WHERE r.referrer_id = user_id_param 
    AND r.status = 'active'
    AND sc.platform = 'x'
    AND sc.is_active = true;

  -- Update all tasks for this user
  FOR task_record IN 
    SELECT * FROM user_tasks WHERE user_id = user_id_param
  LOOP
    UPDATE user_tasks 
    SET 
      current_progress = LEAST(referral_count, task_target),
      completed = (referral_count >= task_target),
      completed_at = CASE 
        WHEN referral_count >= task_target AND NOT completed THEN now()
        ELSE completed_at
      END
    WHERE id = task_record.id;
    
    -- Award points if task just completed
    IF referral_count >= task_record.task_target AND NOT task_record.completed THEN
      UPDATE users 
      SET current_points = current_points + task_record.points_earned
      WHERE id = user_id_param;
    END IF;
  END LOOP;
END;
$$;

-- Initialize user tasks function
CREATE OR REPLACE FUNCTION initialize_user_tasks(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_tasks (user_id, task_type, task_target, points_earned)
  VALUES 
    (user_id_param, 'invite_1', 1, 50),
    (user_id_param, 'invite_5', 5, 100),
    (user_id_param, 'invite_10', 10, 200),
    (user_id_param, 'invite_50', 50, 500),
    (user_id_param, 'invite_100', 100, 1000)
  ON CONFLICT (user_id, task_type) DO NOTHING;
END;
$$;

-- =============================================
-- STEP 6: Create triggers
-- =============================================

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_user_created ON users;
DROP TRIGGER IF EXISTS trigger_init_user_tasks ON users;
DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections;

-- User creation trigger
CREATE TRIGGER on_user_created 
  BEFORE INSERT ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- Initialize tasks trigger
CREATE TRIGGER trigger_init_user_tasks 
  AFTER INSERT ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION initialize_user_tasks();

-- Social connection trigger
CREATE TRIGGER trigger_activate_referrals_social 
  AFTER INSERT OR UPDATE ON social_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION activate_referrals_on_social_connection();

-- =============================================
-- STEP 7: Create indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_current_points ON users(current_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users(current_rank);
CREATE INDEX IF NOT EXISTS idx_users_kinde_user_id ON users(kinde_user_id);
CREATE INDEX IF NOT EXISTS idx_users_x_connected_at ON users(x_connected_at);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_user_id ON social_connections(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform ON social_connections(user_id, platform, is_active);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id_active ON social_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_active ON social_connections(platform, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_type ON user_tasks(task_type);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_type ON user_notifications(user_id, notification_type);

CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referee_id ON referral_tracking(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referral_code ON referral_tracking(referral_code);

CREATE INDEX IF NOT EXISTS idx_point_awards_user_id ON point_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_point_awards_award_type ON point_awards(award_type);
CREATE INDEX IF NOT EXISTS idx_point_awards_created_at ON point_awards(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_x_task_completions_user_id ON x_task_completions(user_id);

-- =============================================
-- STEP 8: Ensure data consistency
-- =============================================

-- Ensure all users have referral codes
UPDATE users 
SET referral_code = generate_referral_code(id)
WHERE referral_code IS NULL;

-- Ensure all users have default values
UPDATE users 
SET 
  current_points = COALESCE(current_points, 0),
  current_rank = COALESCE(current_rank, 0),
  is_active = COALESCE(is_active, true),
  points = COALESCE(points, 0)
WHERE current_points IS NULL OR current_rank IS NULL OR is_active IS NULL OR points IS NULL;

-- =============================================
-- STEP 9: Grant permissions
-- =============================================

GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION handle_new_user() TO public;
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION activate_referrals_on_social_connection() TO public;
GRANT EXECUTE ON FUNCTION increment_user_points(uuid, integer) TO public;
GRANT EXECUTE ON FUNCTION update_task_progress(uuid) TO public;
GRANT EXECUTE ON FUNCTION initialize_user_tasks(uuid) TO public;