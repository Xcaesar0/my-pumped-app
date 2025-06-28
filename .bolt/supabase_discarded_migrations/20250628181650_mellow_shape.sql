/*
  # Consolidated Migration for New Database

  This migration combines all the essential changes from previous migrations into a single file
  that can be applied to the new database. It includes:

  1. Core Table Creation
    - users
    - social_connections
    - referrals
    - referral_tracking
    - point_awards
    - points_transactions
    - user_notifications
    - admin_tasks
    - user_task_submissions
    - x_task_completions

  2. Essential Functions
    - generate_referral_code
    - handle_new_user
    - process_referral_code_entry
    - process_social_connection_points
    - process_x_task_completion
    - activate_referrals_on_social_connection
    - trigger_social_connection_points

  3. Triggers
    - on_user_created
    - trigger_social_connection_points

  4. RLS Policies
    - Public access policies for all tables
*/

-- =============================================
-- STEP 1: Create core tables
-- =============================================

-- Users table
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
  auth_provider text DEFAULT 'direct',
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

-- Referral tracking table
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

-- Admin tasks table
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  description text,
  platform text NOT NULL CHECK (platform IN ('x', 'telegram', 'general')),
  points integer NOT NULL DEFAULT 0,
  action_url text,
  verification_type text NOT NULL DEFAULT 'manual' CHECK (verification_type IN ('manual', 'api', 'social')),
  requires_connection boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- User task submissions table
CREATE TABLE IF NOT EXISTS user_task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_task_id uuid NOT NULL REFERENCES admin_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT unique_user_task_submission UNIQUE (user_id, admin_task_id)
);

-- X task completions table
CREATE TABLE IF NOT EXISTS x_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  x_username text NOT NULL,
  task_title text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  CONSTRAINT x_task_completions_user_task_unique UNIQUE (user_id, task_title)
);

-- =============================================
-- STEP 2: Enable RLS on all tables
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x_task_completions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 3: Create essential functions
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
  referrer_username text;
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
  SELECT id, username INTO referrer_user_id, referrer_username
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
  
  -- Create notification for referrer
  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (
    referrer_user_id,
    'new_referral',
    'Someone used your referral code! They need to connect their X account for you to earn 10 points.'
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE SET
    message = EXCLUDED.message,
    created_at = now(),
    dismissed_at = NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'referral_id', referral_id,
    'status', 'pending',
    'referrer_username', referrer_username,
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

-- Process social connection points function
CREATE OR REPLACE FUNCTION process_social_connection_points(
  user_id_param uuid,
  platform_param text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_record record;
  social_connections_count integer;
  is_first_social boolean;
  is_second_social boolean;
  referee_points integer := 0;
  referrer_points integer := 0;
BEGIN
  -- Count current social connections for this user
  SELECT COUNT(*) INTO social_connections_count
  FROM social_connections
  WHERE user_id = user_id_param AND is_active = true;
  
  is_first_social := (social_connections_count = 1);
  is_second_social := (social_connections_count = 2);
  
  -- Award points to user for connecting social account
  IF platform_param = 'x' OR platform_param = 'twitter' THEN
    -- Award +25 points to user for connecting X
    UPDATE users 
    SET current_points = current_points + 25
    WHERE id = user_id_param;
    
    -- Create points transaction
    INSERT INTO points_transactions (user_id, amount, transaction_type, description)
    VALUES (user_id_param, 25, 'social_linking', 'X account connection');
    
    referee_points := 25;
  ELSIF platform_param = 'telegram' THEN
    -- Award +25 points to user for connecting Telegram
    UPDATE users 
    SET current_points = current_points + 25
    WHERE id = user_id_param;
    
    -- Create points transaction
    INSERT INTO points_transactions (user_id, amount, transaction_type, description)
    VALUES (user_id_param, 25, 'social_linking', 'Telegram account connection');
    
    referee_points := 25;
  END IF;
  
  -- Check if this user was referred and update referral
  SELECT * INTO referral_record
  FROM referrals
  WHERE referred_id = user_id_param
  AND status = 'pending';
  
  IF referral_record.id IS NOT NULL THEN
    -- Update referral status to active
    UPDATE referrals 
    SET status = 'active', activated_at = now()
    WHERE id = referral_record.id;
    
    -- Award +10 points to referrer
    UPDATE users 
    SET current_points = current_points + 10
    WHERE id = referral_record.referrer_id;
    
    -- Create points transaction
    INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
    VALUES (referral_record.referrer_id, 10, 'referral_bonus', referral_record.id, 'Referral activation bonus');
    
    referrer_points := 10;
    
    -- Create notification for referrer
    INSERT INTO user_notifications (user_id, notification_type, message)
    VALUES (
      referral_record.referrer_id,
      'referral_activated',
      format('Referral activated! You earned 10 points because your friend connected their %s account.', platform_param)
    )
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
      message = EXCLUDED.message,
      created_at = now(),
      dismissed_at = NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'referee_points', referee_points,
    'referrer_points', referrer_points,
    'is_first_social', is_first_social,
    'is_second_social', is_second_social,
    'total_connections', social_connections_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in process_social_connection_points: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Error processing social connection points: %s', SQLERRM)
    );
END;
$$;

-- Trigger function for social connections
CREATE OR REPLACE FUNCTION trigger_social_connection_points()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only process if this is a new active connection
  IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
    -- Process social connection points
    SELECT process_social_connection_points(NEW.user_id, NEW.platform) INTO result;
    
    -- Log result for debugging
    RAISE NOTICE 'Social connection points processed: %', result;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_social_connection_points: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Process X task completion function
CREATE OR REPLACE FUNCTION process_x_task_completion(
  task_title_param text,
  user_id_param uuid,
  x_username_param text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record record;
  points_awarded integer := 0;
  username_var text;
  task_id uuid;
  completion_id uuid;
  existing_completion_id uuid;
BEGIN
  -- Get user's username
  SELECT username INTO username_var
  FROM users
  WHERE id = user_id_param;
  
  IF username_var IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if task already completed
  SELECT id INTO existing_completion_id
  FROM x_task_completions
  WHERE user_id = user_id_param AND task_title = task_title_param;
  
  IF existing_completion_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Task already completed', 
      'points_awarded', 0,
      'completion_id', existing_completion_id
    );
  END IF;
  
  -- Find task in admin_tasks
  SELECT id, points INTO task_record
  FROM admin_tasks
  WHERE title = task_title_param AND platform = 'x' AND is_active = true;
  
  -- Set task ID and points
  IF task_record.id IS NOT NULL THEN
    task_id := task_record.id;
    points_awarded := task_record.points;
  ELSE
    -- Default points if task not found in admin_tasks
    CASE task_title_param
      WHEN 'Follow @pumpeddotfun' THEN points_awarded := 25;
      WHEN 'Repost Launch Post' THEN points_awarded := 50;
      ELSE points_awarded := 25;
    END CASE;
  END IF;
  
  -- Insert task completion
  INSERT INTO x_task_completions (
    user_id,
    username,
    x_username,
    task_title
  ) VALUES (
    user_id_param,
    username_var,
    x_username_param,
    task_title_param
  )
  RETURNING id INTO completion_id;
  
  -- Award points
  UPDATE users
  SET current_points = current_points + points_awarded
  WHERE id = user_id_param;
  
  -- Create points transaction
  INSERT INTO points_transactions (
    user_id,
    amount,
    transaction_type,
    reference_id,
    description
  ) VALUES (
    user_id_param,
    points_awarded,
    'task_completion',
    completion_id,
    format('Completed X task: %s', task_title_param)
  );
  
  -- If task exists in admin_tasks, create a submission record
  IF task_id IS NOT NULL THEN
    INSERT INTO user_task_submissions (
      user_id,
      admin_task_id,
      status,
      reviewed_at
    ) VALUES (
      user_id_param,
      task_id,
      'approved',
      now()
    )
    ON CONFLICT (user_id, admin_task_id) 
    DO UPDATE SET 
      status = 'approved',
      reviewed_at = now();
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', points_awarded,
    'completion_id', completion_id,
    'message', format('Task completed! You earned %s points.', points_awarded)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in process_x_task_completion: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Error processing X task completion: %s', SQLERRM)
    );
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

-- =============================================
-- STEP 4: Create RLS policies
-- =============================================

-- Users table policies
CREATE POLICY "Public can insert user data" ON users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read user data" ON users FOR SELECT TO public USING (true);
CREATE POLICY "Public can update user data" ON users FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Social connections policies
CREATE POLICY "Public can insert social connections" ON social_connections FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read social connections" ON social_connections FOR SELECT TO public USING (true);
CREATE POLICY "Public can update social connections" ON social_connections FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete social connections" ON social_connections FOR DELETE TO public USING (true);

-- Referrals policies
CREATE POLICY "Public can read referrals" ON referrals FOR SELECT TO public USING (true);
CREATE POLICY "Public can create referrals" ON referrals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update referrals" ON referrals FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Referral tracking policies
CREATE POLICY "Public can read referral tracking" ON referral_tracking FOR SELECT TO public USING (true);
CREATE POLICY "Public can manage referral tracking" ON referral_tracking FOR ALL TO public USING (true) WITH CHECK (true);

-- Point awards policies
CREATE POLICY "Public can read point awards" ON point_awards FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert point awards" ON point_awards FOR INSERT TO public WITH CHECK (true);

-- Points transactions policies
CREATE POLICY "Public can insert point transactions" ON points_transactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can read point transactions" ON points_transactions FOR SELECT TO public USING (true);

-- User notifications policies
CREATE POLICY "Public can read user notifications" ON user_notifications FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert user notifications" ON user_notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update user notifications" ON user_notifications FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Admin tasks policies
CREATE POLICY "Public can read active admin tasks" ON admin_tasks FOR SELECT TO public USING (is_active = true);

-- User task submissions policies
CREATE POLICY "Public can read user task submissions" ON user_task_submissions FOR SELECT TO public USING (true);
CREATE POLICY "Public can create user task submissions" ON user_task_submissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update user task submissions" ON user_task_submissions FOR UPDATE TO public USING (true);

-- X task completions policies
CREATE POLICY "Public can read x task completions" ON x_task_completions FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert x task completions" ON x_task_completions FOR INSERT TO public WITH CHECK (true);

-- =============================================
-- STEP 5: Create triggers
-- =============================================

-- User creation trigger
CREATE TRIGGER on_user_created 
  BEFORE INSERT ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- Social connection trigger
CREATE TRIGGER trigger_social_connection_points 
  AFTER INSERT OR UPDATE ON social_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_social_connection_points();

-- =============================================
-- STEP 6: Create indexes for performance
-- =============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_current_points ON users(current_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_rank ON users(current_rank);
CREATE INDEX IF NOT EXISTS idx_users_kinde_user_id ON users(kinde_user_id);
CREATE INDEX IF NOT EXISTS idx_users_x_connected_at ON users(x_connected_at);

-- Social connections indexes
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_user_id ON social_connections(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform ON social_connections(user_id, platform, is_active);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id_active ON social_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_social_connections_platform_active ON social_connections(platform, is_active) WHERE is_active = true;

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_expires_at ON referrals(expires_at);

-- Referral tracking indexes
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referee_id ON referral_tracking(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referral_code ON referral_tracking(referral_code);

-- Point awards indexes
CREATE INDEX IF NOT EXISTS idx_point_awards_user_id ON point_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_point_awards_award_type ON point_awards(award_type);
CREATE INDEX IF NOT EXISTS idx_point_awards_created_at ON point_awards(created_at DESC);

-- Points transactions indexes
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);

-- User notifications indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_type ON user_notifications(user_id, notification_type);

-- Admin tasks indexes
CREATE INDEX IF NOT EXISTS idx_admin_tasks_platform ON admin_tasks(platform);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_active ON admin_tasks(is_active);

-- User task submissions indexes
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user_id ON user_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_admin_task_id ON user_task_submissions(admin_task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_status ON user_task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_user_task_submissions_user_status ON user_task_submissions(user_id, status);

-- X task completions indexes
CREATE INDEX IF NOT EXISTS idx_x_task_completions_user_id ON x_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_x_task_completions_user_task ON x_task_completions(user_id, task_title);

-- =============================================
-- STEP 7: Insert default admin tasks
-- =============================================

INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection) VALUES
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 25, 'https://t.me/pumpeddotfun', 'manual', true),
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 25, 'https://x.com/pumpeddotfun', 'manual', true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 50, 'https://x.com/pumpeddotfun/status/123456789', 'manual', true)
ON CONFLICT (title) DO UPDATE SET
  platform = EXCLUDED.platform,
  points = EXCLUDED.points,
  requires_connection = EXCLUDED.requires_connection,
  is_active = true;

-- =============================================
-- STEP 8: Grant permissions
-- =============================================

GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION handle_new_user() TO public;
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION activate_referrals_on_social_connection() TO public;
GRANT EXECUTE ON FUNCTION process_social_connection_points(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION trigger_social_connection_points() TO public;
GRANT EXECUTE ON FUNCTION process_x_task_completion(text, uuid, text) TO public;
GRANT EXECUTE ON FUNCTION increment_user_points(uuid, integer) TO public;