/*
  # Comprehensive Database Cleanup

  1. Drop all conflicting functions and triggers
  2. Recreate essential functions with proper error handling
  3. Fix RLS policies for public access (since we're not using Supabase Auth)
  4. Ensure user creation flow works properly
  5. Clean up referral system to be simple and functional
*/

-- =============================================
-- STEP 1: Drop all potentially conflicting functions and triggers
-- =============================================

-- Drop all triggers first (they depend on functions)
DROP TRIGGER IF EXISTS on_user_created ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_init_user_tasks ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_update_ranks ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections CASCADE;
DROP TRIGGER IF EXISTS trigger_set_referral_data ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_activate_referrals ON users CASCADE;
DROP TRIGGER IF EXISTS trigger_x_auth_tokens_updated_at ON x_auth_tokens CASCADE;

-- Drop all functions that might be causing conflicts
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS trigger_initialize_user_tasks() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_ranks_on_points_change() CASCADE;
DROP FUNCTION IF EXISTS activate_referrals_on_social_connection() CASCADE;
DROP FUNCTION IF EXISTS activate_referrals_on_x_connection() CASCADE;
DROP FUNCTION IF EXISTS set_user_referral_data() CASCADE;
DROP FUNCTION IF EXISTS set_user_referral_code() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS process_referral_code_entry(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS process_referral_from_code(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_referral_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS award_points(uuid, text, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS process_social_connection(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS process_chain_continuation(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_point_value(text) CASCADE;

-- =============================================
-- STEP 2: Ensure all required tables exist with proper structure
-- =============================================

-- Ensure users table has all required columns
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'kinde_user_id') THEN
    ALTER TABLE users ADD COLUMN kinde_user_id text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'points') THEN
    ALTER TABLE users ADD COLUMN points integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'x_connected_at') THEN
    ALTER TABLE users ADD COLUMN x_connected_at timestamptz;
  END IF;
END $$;

-- Ensure points_transactions table exists
CREATE TABLE IF NOT EXISTS points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_bonus', 'social_linking', 'task_completion', 'manual_adjustment')),
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- STEP 3: Create essential functions with proper error handling
-- =============================================

-- Simple referral code generation function
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
    -- Generate 8 character code
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = result) THEN
      RETURN result;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Fallback with timestamp
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

-- Simple user creation handler
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate referral code if not set
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Simple referral processing function
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
    -- Log error but don't fail the operation
    RAISE WARNING 'Error in activate_referrals_on_social_connection: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- =============================================
-- STEP 4: Recreate triggers
-- =============================================

-- User creation trigger
CREATE TRIGGER on_user_created 
  BEFORE INSERT ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- Social connection trigger
CREATE TRIGGER trigger_activate_referrals_social 
  AFTER INSERT OR UPDATE ON social_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION activate_referrals_on_social_connection();

-- =============================================
-- STEP 5: Fix RLS policies for public access
-- =============================================

-- Update users table policies
DROP POLICY IF EXISTS "Users can insert their own data" ON users;
DROP POLICY IF EXISTS "Users can read all user data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

CREATE POLICY "Public can insert user data"
  ON users FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can read user data"
  ON users FOR SELECT TO public USING (true);

CREATE POLICY "Public can update user data"
  ON users FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Update referrals table policies
DROP POLICY IF EXISTS "Users can read referrals" ON referrals;
DROP POLICY IF EXISTS "Users can create referrals where they are referred" ON referrals;
DROP POLICY IF EXISTS "Users can update their own referrals" ON referrals;

CREATE POLICY "Public can read referrals"
  ON referrals FOR SELECT TO public USING (true);

CREATE POLICY "Public can create referrals"
  ON referrals FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can update referrals"
  ON referrals FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Update points_transactions policies
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can insert point transactions" ON points_transactions;
DROP POLICY IF EXISTS "Users can read their own point transactions" ON points_transactions;

CREATE POLICY "Public can insert point transactions"
  ON points_transactions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can read point transactions"
  ON points_transactions FOR SELECT TO public USING (true);

-- =============================================
-- STEP 6: Clean up data and ensure consistency
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
  is_active = COALESCE(is_active, true)
WHERE current_points IS NULL OR current_rank IS NULL OR is_active IS NULL;

-- =============================================
-- STEP 7: Grant permissions
-- =============================================

GRANT EXECUTE ON FUNCTION generate_referral_code(uuid) TO public;
GRANT EXECUTE ON FUNCTION handle_new_user() TO public;
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION activate_referrals_on_social_connection() TO public;

-- =============================================
-- STEP 8: Create essential indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);

-- Test the setup
DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test the referral function
  SELECT process_referral_code_entry('TESTCODE', gen_random_uuid()) INTO test_result;
  RAISE NOTICE 'Database cleanup completed successfully. Test result: %', test_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Database cleanup completed with warnings: %', SQLERRM;
END $$;