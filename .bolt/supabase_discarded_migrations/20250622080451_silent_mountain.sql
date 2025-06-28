/*
  # New Referral Point System Implementation

  This migration implements the new referral system with the following rewards:

  Referrer earns:
  - +25 points when someone enters their referral code
  - +10 points if that referred user connects one social account (Twitter or Telegram)
  - +15 additional points if they connect a second social account
  - +50 points if their referred user refers someone else
  Total: Up to 100 points per successful referral chain

  Referee earns:
  - +25 points for entering a referral code
  - +25 points for connecting Twitter
  - +25 points for connecting Telegram
  - +25 points if they refer someone themselves
  Total: Up to 100 points total by continuing the cycle

  1. Clean up old system
  2. Create new tracking tables
  3. Implement new point award functions
  4. Set up triggers for automatic point awards
*/

-- =============================================
-- STEP 1: Clean up old referral system
-- =============================================

-- Drop old triggers and functions
DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections CASCADE;
DROP FUNCTION IF EXISTS activate_referrals_on_social_connection() CASCADE;
DROP FUNCTION IF EXISTS process_referral_code_entry(text, uuid) CASCADE;

-- Drop old referral tracking tables that we'll replace
DROP TABLE IF EXISTS referral_chains CASCADE;
DROP TABLE IF EXISTS point_events CASCADE;
DROP TABLE IF EXISTS social_account_connections CASCADE;
DROP TABLE IF EXISTS point_rules CASCADE;

-- =============================================
-- STEP 2: Create new referral tracking system
-- =============================================

-- Enhanced referral tracking table
CREATE TABLE IF NOT EXISTS referral_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  
  -- Point tracking
  code_entry_points_awarded boolean DEFAULT false,
  first_social_points_awarded boolean DEFAULT false,
  second_social_points_awarded boolean DEFAULT false,
  chain_continuation_points_awarded boolean DEFAULT false,
  
  -- Social connection tracking
  twitter_connected boolean DEFAULT false,
  telegram_connected boolean DEFAULT false,
  twitter_connected_at timestamptz,
  telegram_connected_at timestamptz,
  
  -- Chain tracking
  has_referred_someone boolean DEFAULT false,
  chain_continued_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(referrer_id, referee_id)
);

-- Point award history table
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
  reference_id uuid, -- Can reference referral_tracking or social_connections
  reference_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can read referral tracking"
  ON referral_tracking FOR SELECT TO public USING (true);

CREATE POLICY "Public can manage referral tracking"
  ON referral_tracking FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can read point awards"
  ON point_awards FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert point awards"
  ON point_awards FOR INSERT TO public WITH CHECK (true);

-- =============================================
-- STEP 3: Create point award functions
-- =============================================

-- Function to award points and track the award
CREATE OR REPLACE FUNCTION award_referral_points(
  user_id_param uuid,
  award_type_param text,
  points_param integer,
  reference_id_param uuid DEFAULT NULL,
  reference_type_param text DEFAULT NULL,
  metadata_param jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Award points to user
  UPDATE users 
  SET current_points = current_points + points_param
  WHERE id = user_id_param;
  
  -- Record the point award
  INSERT INTO point_awards (
    user_id, 
    award_type, 
    points_awarded, 
    reference_id, 
    reference_type, 
    metadata
  ) VALUES (
    user_id_param,
    award_type_param,
    points_param,
    reference_id_param,
    reference_type_param,
    metadata_param
  );
  
  -- Create points transaction for compatibility
  INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
  VALUES (
    user_id_param, 
    points_param, 
    'referral_bonus', 
    reference_id_param, 
    award_type_param
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error awarding points: %', SQLERRM;
    RETURN false;
END;
$$;

-- Function to process referral code entry
CREATE OR REPLACE FUNCTION process_referral_code_entry(
  referral_code_param text,
  referee_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_user record;
  existing_referral_count integer;
  tracking_id uuid;
  clean_code text;
  referrer_points_awarded boolean;
  referee_points_awarded boolean;
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
  SELECT id, username INTO referrer_user
  FROM users
  WHERE referral_code = clean_code
  AND is_active = true;
  
  IF referrer_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referrals
  IF referrer_user.id = referee_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if user already has a referral
  SELECT COUNT(*) INTO existing_referral_count
  FROM referral_tracking
  WHERE referee_id = referee_id_param;
  
  IF existing_referral_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Create referral tracking record
  INSERT INTO referral_tracking (
    referrer_id,
    referee_id,
    referral_code,
    code_entry_points_awarded,
    updated_at
  ) VALUES (
    referrer_user.id,
    referee_id_param,
    clean_code,
    true,
    now()
  ) RETURNING id INTO tracking_id;
  
  -- Award +25 points to referrer for code entry
  referrer_points_awarded := award_referral_points(
    referrer_user.id,
    'referral_code_entry_referrer',
    25,
    tracking_id,
    'referral_tracking',
    jsonb_build_object('referee_id', referee_id_param, 'action', 'code_entry')
  );
  
  -- Award +25 points to referee for entering code
  referee_points_awarded := award_referral_points(
    referee_id_param,
    'referral_code_entry_referee',
    25,
    tracking_id,
    'referral_tracking',
    jsonb_build_object('referrer_id', referrer_user.id, 'action', 'code_entry')
  );
  
  -- Create notification for referrer
  INSERT INTO user_notifications (user_id, notification_type, message)
  VALUES (
    referrer_user.id,
    'new_referral',
    format('Someone used your referral code! You earned 25 points. They can earn you more by connecting social accounts.')
  )
  ON CONFLICT (user_id, notification_type) DO UPDATE SET
    message = EXCLUDED.message,
    created_at = now(),
    dismissed_at = NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'tracking_id', tracking_id,
    'referrer_points_awarded', referrer_points_awarded,
    'referee_points_awarded', referee_points_awarded,
    'message', format('Referral code applied successfully! You earned 25 points, %s earned 25 points.', referrer_user.username)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('An error occurred while processing the referral code: %s', SQLERRM)
    );
END;
$$;

-- Function to process social connection and award points
CREATE OR REPLACE FUNCTION process_social_connection_points(
  user_id_param uuid,
  platform_param text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tracking_record record;
  social_connections_count integer;
  is_first_social boolean;
  is_second_social boolean;
  referee_points_awarded boolean := false;
  referrer_points_awarded boolean := false;
  points_awarded integer := 0;
  referrer_points integer := 0;
BEGIN
  -- Count current social connections for this user
  SELECT COUNT(*) INTO social_connections_count
  FROM social_connections
  WHERE user_id = user_id_param AND is_active = true;
  
  is_first_social := (social_connections_count = 1);
  is_second_social := (social_connections_count = 2);
  
  -- Award points to referee for connecting social account
  IF platform_param = 'x' OR platform_param = 'twitter' THEN
    referee_points_awarded := award_referral_points(
      user_id_param,
      'twitter_connection_referee',
      25,
      NULL,
      'social_connection',
      jsonb_build_object('platform', platform_param, 'connection_number', social_connections_count)
    );
    points_awarded := 25;
  ELSIF platform_param = 'telegram' THEN
    referee_points_awarded := award_referral_points(
      user_id_param,
      'telegram_connection_referee',
      25,
      NULL,
      'social_connection',
      jsonb_build_object('platform', platform_param, 'connection_number', social_connections_count)
    );
    points_awarded := 25;
  END IF;
  
  -- Check if this user was referred and update tracking
  SELECT * INTO tracking_record
  FROM referral_tracking
  WHERE referee_id = user_id_param;
  
  IF tracking_record.id IS NOT NULL THEN
    -- Update tracking record
    IF platform_param IN ('x', 'twitter') THEN
      UPDATE referral_tracking
      SET 
        twitter_connected = true,
        twitter_connected_at = now(),
        updated_at = now()
      WHERE id = tracking_record.id;
    ELSIF platform_param = 'telegram' THEN
      UPDATE referral_tracking
      SET 
        telegram_connected = true,
        telegram_connected_at = now(),
        updated_at = now()
      WHERE id = tracking_record.id;
    END IF;
    
    -- Award points to referrer based on connection number
    IF is_first_social AND NOT tracking_record.first_social_points_awarded THEN
      -- Award +10 points to referrer for first social connection
      referrer_points_awarded := award_referral_points(
        tracking_record.referrer_id,
        'first_social_connection_referrer',
        10,
        tracking_record.id,
        'referral_tracking',
        jsonb_build_object('referee_id', user_id_param, 'platform', platform_param, 'action', 'first_social')
      );
      referrer_points := 10;
      
      -- Mark as awarded
      UPDATE referral_tracking
      SET first_social_points_awarded = true
      WHERE id = tracking_record.id;
      
    ELSIF is_second_social AND NOT tracking_record.second_social_points_awarded THEN
      -- Award +15 points to referrer for second social connection
      referrer_points_awarded := award_referral_points(
        tracking_record.referrer_id,
        'second_social_connection_referrer',
        15,
        tracking_record.id,
        'referral_tracking',
        jsonb_build_object('referee_id', user_id_param, 'platform', platform_param, 'action', 'second_social')
      );
      referrer_points := 15;
      
      -- Mark as awarded
      UPDATE referral_tracking
      SET second_social_points_awarded = true
      WHERE id = tracking_record.id;
    END IF;
    
    -- Create notification for referrer if points were awarded
    IF referrer_points > 0 THEN
      INSERT INTO user_notifications (user_id, notification_type, message)
      VALUES (
        tracking_record.referrer_id,
        'referral_social_connection',
        format('Your referred user connected %s! You earned %s points.', platform_param, referrer_points)
      )
      ON CONFLICT (user_id, notification_type) DO UPDATE SET
        message = EXCLUDED.message,
        created_at = now(),
        dismissed_at = NULL;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'referee_points_awarded', referee_points_awarded,
    'referee_points', points_awarded,
    'referrer_points_awarded', referrer_points_awarded,
    'referrer_points', referrer_points,
    'is_first_social', is_first_social,
    'is_second_social', is_second_social,
    'total_connections', social_connections_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Error processing social connection points: %s', SQLERRM)
    );
END;
$$;

-- Function to process chain continuation (when referee refers someone)
CREATE OR REPLACE FUNCTION process_chain_continuation(
  new_referrer_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_tracking_record record;
  continuation_points_awarded boolean := false;
  self_referral_points_awarded boolean := false;
BEGIN
  -- Check if the new referrer was previously a referee
  SELECT * INTO original_tracking_record
  FROM referral_tracking
  WHERE referee_id = new_referrer_id_param
  AND NOT chain_continuation_points_awarded;
  
  IF original_tracking_record.id IS NOT NULL THEN
    -- Award +50 points to the original referrer for chain continuation
    continuation_points_awarded := award_referral_points(
      original_tracking_record.referrer_id,
      'chain_continuation_referrer',
      50,
      original_tracking_record.id,
      'referral_tracking',
      jsonb_build_object(
        'continued_by', new_referrer_id_param,
        'action', 'chain_continuation'
      )
    );
    
    -- Mark chain continuation as awarded
    UPDATE referral_tracking
    SET 
      has_referred_someone = true,
      chain_continued_at = now(),
      chain_continuation_points_awarded = true,
      updated_at = now()
    WHERE id = original_tracking_record.id;
    
    -- Create notification for original referrer
    INSERT INTO user_notifications (user_id, notification_type, message)
    VALUES (
      original_tracking_record.referrer_id,
      'referral_chain_continuation',
      'Your referred user referred someone else! You earned 50 bonus points for continuing the chain.'
    )
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
      message = EXCLUDED.message,
      created_at = now(),
      dismissed_at = NULL;
  END IF;
  
  -- Award +25 points to the new referrer for making their first referral
  self_referral_points_awarded := award_referral_points(
    new_referrer_id_param,
    'self_referral_referee',
    25,
    NULL,
    'self_action',
    jsonb_build_object('action', 'first_referral')
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'continuation_points_awarded', continuation_points_awarded,
    'self_referral_points_awarded', self_referral_points_awarded,
    'original_referrer_id', original_tracking_record.referrer_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Error processing chain continuation: %s', SQLERRM)
    );
END;
$$;

-- =============================================
-- STEP 4: Create triggers for automatic point awards
-- =============================================

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

-- Trigger function for referral tracking when new referrals are created
CREATE OR REPLACE FUNCTION trigger_chain_continuation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Process chain continuation when a new referral tracking record is created
  SELECT process_chain_continuation(NEW.referrer_id) INTO result;
  
  -- Log result for debugging
  RAISE NOTICE 'Chain continuation processed: %', result;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_chain_continuation: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_social_connection_points
  AFTER INSERT OR UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_social_connection_points();

CREATE TRIGGER trigger_chain_continuation
  AFTER INSERT ON referral_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_chain_continuation();

-- =============================================
-- STEP 5: Create indexes for performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referee_id ON referral_tracking(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referral_code ON referral_tracking(referral_code);
CREATE INDEX IF NOT EXISTS idx_point_awards_user_id ON point_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_point_awards_award_type ON point_awards(award_type);
CREATE INDEX IF NOT EXISTS idx_point_awards_created_at ON point_awards(created_at DESC);

-- =============================================
-- STEP 6: Grant permissions
-- =============================================

GRANT EXECUTE ON FUNCTION award_referral_points(uuid, text, integer, uuid, text, jsonb) TO public;
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION process_social_connection_points(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION process_chain_continuation(uuid) TO public;
GRANT EXECUTE ON FUNCTION trigger_social_connection_points() TO public;
GRANT EXECUTE ON FUNCTION trigger_chain_continuation() TO public;

-- =============================================
-- STEP 7: Test the new system
-- =============================================

DO $$
DECLARE
  test_result jsonb;
BEGIN
  -- Test the referral function
  SELECT process_referral_code_entry('TESTCODE', gen_random_uuid()) INTO test_result;
  RAISE NOTICE 'New referral system test completed. Result: %', test_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'New referral system test failed: %', SQLERRM;
END $$;