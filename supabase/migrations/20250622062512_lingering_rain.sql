/*
  # Dynamic Referral Point System

  1. New Tables
    - `point_rules` - Configurable point values for different actions
    - `point_events` - Tracks every point award with full context
    - `referral_chains` - Enhanced referral tracking with status progression
    - `social_account_connections` - Social media connection tracking

  2. Functions
    - `get_point_value()` - Get point value for a rule
    - `award_points()` - Central function for awarding points with tracking
    - `process_referral_code_entry()` - Handle referral code usage
    - `process_social_connection()` - Handle social account connections
    - `process_chain_continuation()` - Handle referral chain continuation

  3. Security
    - Enable RLS on all tables
    - Add appropriate policies for data access
*/

-- Point rules configuration table
CREATE TABLE IF NOT EXISTS point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text UNIQUE NOT NULL,
  points integer NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Point events tracking table
CREATE TABLE IF NOT EXISTS point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  points_awarded integer NOT NULL,
  reference_id uuid, -- Can reference referral_chains, social_connections, etc.
  reference_type text, -- 'referral', 'social_connection', 'bonus_task', etc.
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT point_events_event_type_check 
  CHECK (event_type IN (
    'referral_code_entry',
    'first_social_connection', 
    'second_social_connection',
    'referral_chain_continuation',
    'twitter_connection',
    'telegram_connection',
    'self_referral',
    'bonus_task'
  ))
);

-- Enhanced referral chains tracking
CREATE TABLE IF NOT EXISTS referral_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  
  -- Status tracking
  status text DEFAULT 'code_entered' CHECK (status IN (
    'code_entered',           -- +25 to referrer, +25 to referee
    'first_social_connected', -- +10 to referrer, +25 to referee (Twitter or Telegram)
    'both_socials_connected', -- +15 to referrer, +25 to referee (second social)
    'chain_continued',        -- +50 to referrer, +25 to referee (referee referred someone)
    'completed'               -- All possible points awarded
  )),
  
  -- Social connection tracking
  twitter_connected_at timestamptz,
  telegram_connected_at timestamptz,
  chain_continued_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(referrer_id, referee_id)
);

-- Social account connections tracking (enhanced)
CREATE TABLE IF NOT EXISTS social_account_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('twitter', 'telegram')),
  platform_user_id text NOT NULL,
  platform_username text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  
  -- Track if this connection triggered point awards
  points_awarded boolean DEFAULT false,
  
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_account_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can read active point rules" ON point_rules;
  DROP POLICY IF EXISTS "Users can read their own point events" ON point_events;
  DROP POLICY IF EXISTS "Users can read referral chains they're involved in" ON referral_chains;
  DROP POLICY IF EXISTS "Users can read their own social connections" ON social_account_connections;
  DROP POLICY IF EXISTS "System can manage point events" ON point_events;
  DROP POLICY IF EXISTS "System can manage referral chains" ON referral_chains;
  DROP POLICY IF EXISTS "System can manage social connections" ON social_account_connections;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- RLS Policies
CREATE POLICY "Public can read active point rules"
  ON point_rules FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Users can read their own point events"
  ON point_events FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can read referral chains they're involved in"
  ON referral_chains FOR SELECT TO public
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE POLICY "Users can read their own social connections"
  ON social_account_connections FOR SELECT TO public
  USING (user_id = auth.uid());

-- System policies for inserting/updating
CREATE POLICY "System can manage point events"
  ON point_events FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE POLICY "System can manage referral chains"
  ON referral_chains FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE POLICY "System can manage social connections"
  ON social_account_connections FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_point_rules_rule_name ON point_rules(rule_name);
CREATE INDEX IF NOT EXISTS idx_point_rules_is_active ON point_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_point_events_user_id ON point_events(user_id);
CREATE INDEX IF NOT EXISTS idx_point_events_event_type ON point_events(event_type);
CREATE INDEX IF NOT EXISTS idx_point_events_created_at ON point_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_events_reference_id ON point_events(reference_id);

CREATE INDEX IF NOT EXISTS idx_referral_chains_referrer_id ON referral_chains(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_chains_referee_id ON referral_chains(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_chains_status ON referral_chains(status);
CREATE INDEX IF NOT EXISTS idx_referral_chains_referral_code ON referral_chains(referral_code);

CREATE INDEX IF NOT EXISTS idx_social_account_connections_user_id ON social_account_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_account_connections_platform ON social_account_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_account_connections_is_active ON social_account_connections(is_active);

-- Insert default point rules
INSERT INTO point_rules (rule_name, points, description) VALUES
('referral_code_entry_referrer', 25, 'Points awarded to referrer when someone enters their code'),
('referral_code_entry_referee', 25, 'Points awarded to referee when they enter a referral code'),
('first_social_connection_referrer', 10, 'Points awarded to referrer when referee connects first social account'),
('second_social_connection_referrer', 15, 'Points awarded to referrer when referee connects second social account'),
('chain_continuation_referrer', 50, 'Points awarded to referrer when referee refers someone else'),
('twitter_connection_referee', 25, 'Points awarded to referee for connecting Twitter'),
('telegram_connection_referee', 25, 'Points awarded to referee for connecting Telegram'),
('self_referral_referee', 25, 'Points awarded to referee for referring someone themselves')
ON CONFLICT (rule_name) DO NOTHING;

-- Function to get point value for a rule
CREATE OR REPLACE FUNCTION get_point_value(rule_name_param text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  point_value integer;
BEGIN
  SELECT points INTO point_value
  FROM point_rules
  WHERE rule_name = rule_name_param AND is_active = true;
  
  RETURN COALESCE(point_value, 0);
END;
$$;

-- Function to award points with tracking
CREATE OR REPLACE FUNCTION award_points(
  user_id_param uuid,
  event_type_param text,
  reference_id_param uuid DEFAULT NULL,
  reference_type_param text DEFAULT NULL,
  metadata_param jsonb DEFAULT '{}'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  points_to_award integer;
  rule_name_to_use text;
BEGIN
  -- Determine rule name based on event type
  CASE event_type_param
    WHEN 'referral_code_entry' THEN
      -- Determine if this is for referrer or referee based on metadata
      IF (metadata_param->>'role')::text = 'referrer' THEN
        rule_name_to_use := 'referral_code_entry_referrer';
      ELSE
        rule_name_to_use := 'referral_code_entry_referee';
      END IF;
    WHEN 'first_social_connection' THEN
      rule_name_to_use := 'first_social_connection_referrer';
    WHEN 'second_social_connection' THEN
      rule_name_to_use := 'second_social_connection_referrer';
    WHEN 'referral_chain_continuation' THEN
      rule_name_to_use := 'chain_continuation_referrer';
    WHEN 'twitter_connection' THEN
      rule_name_to_use := 'twitter_connection_referee';
    WHEN 'telegram_connection' THEN
      rule_name_to_use := 'telegram_connection_referee';
    WHEN 'self_referral' THEN
      rule_name_to_use := 'self_referral_referee';
    ELSE
      RAISE EXCEPTION 'Unknown event type: %', event_type_param;
  END CASE;
  
  -- Get point value
  points_to_award := get_point_value(rule_name_to_use);
  
  IF points_to_award > 0 THEN
    -- Award points to user
    UPDATE users 
    SET current_points = current_points + points_to_award
    WHERE id = user_id_param;
    
    -- Record the point event
    INSERT INTO point_events (
      user_id, 
      event_type, 
      points_awarded, 
      reference_id, 
      reference_type, 
      metadata
    ) VALUES (
      user_id_param,
      event_type_param,
      points_to_award,
      reference_id_param,
      reference_type_param,
      metadata_param
    );
  END IF;
  
  RETURN points_to_award;
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
  chain_id uuid;
  referrer_points integer;
  referee_points integer;
BEGIN
  -- Find referrer
  SELECT id, username INTO referrer_user
  FROM users
  WHERE referral_code = UPPER(TRIM(referral_code_param))
  AND is_active = true;
  
  IF referrer_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  IF referrer_user.id = referee_id_param THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Check if referral chain already exists
  IF EXISTS (SELECT 1 FROM referral_chains WHERE referee_id = referee_id_param) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Create referral chain
  INSERT INTO referral_chains (referrer_id, referee_id, referral_code, status)
  VALUES (referrer_user.id, referee_id_param, UPPER(TRIM(referral_code_param)), 'code_entered')
  RETURNING id INTO chain_id;
  
  -- Award points to referrer
  referrer_points := award_points(
    referrer_user.id,
    'referral_code_entry',
    chain_id,
    'referral_chain',
    jsonb_build_object('role', 'referrer', 'referee_id', referee_id_param)
  );
  
  -- Award points to referee
  referee_points := award_points(
    referee_id_param,
    'referral_code_entry',
    chain_id,
    'referral_chain',
    jsonb_build_object('role', 'referee', 'referrer_id', referrer_user.id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'chain_id', chain_id,
    'referrer_points', referrer_points,
    'referee_points', referee_points,
    'message', format('Success! You earned %s points, %s earned %s points', referee_points, referrer_user.username, referrer_points)
  );
END;
$$;

-- Function to process social account connection
CREATE OR REPLACE FUNCTION process_social_connection(
  user_id_param uuid,
  platform_param text,
  platform_user_id_param text,
  platform_username_param text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  connection_id uuid;
  chain_record record;
  is_first_social boolean;
  is_second_social boolean;
  referee_points integer := 0;
  referrer_points integer := 0;
  total_social_connections integer;
BEGIN
  -- Insert or update social connection
  INSERT INTO social_account_connections (
    user_id, platform, platform_user_id, platform_username
  ) VALUES (
    user_id_param, platform_param, platform_user_id_param, platform_username_param
  )
  ON CONFLICT (user_id, platform) 
  DO UPDATE SET 
    platform_user_id = EXCLUDED.platform_user_id,
    platform_username = EXCLUDED.platform_username,
    connected_at = now(),
    is_active = true
  RETURNING id INTO connection_id;
  
  -- Count total social connections for this user
  SELECT COUNT(*) INTO total_social_connections
  FROM social_account_connections
  WHERE user_id = user_id_param AND is_active = true;
  
  is_first_social := (total_social_connections = 1);
  is_second_social := (total_social_connections = 2);
  
  -- Award points to the user for connecting the social account
  IF platform_param = 'twitter' THEN
    referee_points := award_points(
      user_id_param,
      'twitter_connection',
      connection_id,
      'social_connection',
      jsonb_build_object('platform', platform_param)
    );
  ELSIF platform_param = 'telegram' THEN
    referee_points := award_points(
      user_id_param,
      'telegram_connection',
      connection_id,
      'social_connection',
      jsonb_build_object('platform', platform_param)
    );
  END IF;
  
  -- Check if this user was referred and update referral chain
  SELECT * INTO chain_record
  FROM referral_chains
  WHERE referee_id = user_id_param
  AND status IN ('code_entered', 'first_social_connected');
  
  IF chain_record.id IS NOT NULL THEN
    -- Update referral chain status and timestamps
    IF is_first_social THEN
      UPDATE referral_chains
      SET 
        status = 'first_social_connected',
        twitter_connected_at = CASE WHEN platform_param = 'twitter' THEN now() ELSE twitter_connected_at END,
        telegram_connected_at = CASE WHEN platform_param = 'telegram' THEN now() ELSE telegram_connected_at END,
        updated_at = now()
      WHERE id = chain_record.id;
      
      -- Award points to referrer for first social connection
      referrer_points := award_points(
        chain_record.referrer_id,
        'first_social_connection',
        chain_record.id,
        'referral_chain',
        jsonb_build_object('referee_id', user_id_param, 'platform', platform_param)
      );
      
    ELSIF is_second_social THEN
      UPDATE referral_chains
      SET 
        status = 'both_socials_connected',
        twitter_connected_at = CASE WHEN platform_param = 'twitter' THEN now() ELSE twitter_connected_at END,
        telegram_connected_at = CASE WHEN platform_param = 'telegram' THEN now() ELSE telegram_connected_at END,
        updated_at = now()
      WHERE id = chain_record.id;
      
      -- Award points to referrer for second social connection
      referrer_points := award_points(
        chain_record.referrer_id,
        'second_social_connection',
        chain_record.id,
        'referral_chain',
        jsonb_build_object('referee_id', user_id_param, 'platform', platform_param)
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'connection_id', connection_id,
    'referee_points', referee_points,
    'referrer_points', referrer_points,
    'is_first_social', is_first_social,
    'is_second_social', is_second_social,
    'total_connections', total_social_connections
  );
END;
$$;

-- Function to process when someone continues the referral chain
CREATE OR REPLACE FUNCTION process_chain_continuation(
  new_referrer_id_param uuid,
  new_referee_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  original_chain_record record;
  continuation_points integer := 0;
  self_referral_points integer := 0;
BEGIN
  -- Check if the new referrer was previously a referee
  SELECT * INTO original_chain_record
  FROM referral_chains
  WHERE referee_id = new_referrer_id_param;
  
  IF original_chain_record.id IS NOT NULL THEN
    -- Award points to the original referrer for chain continuation
    continuation_points := award_points(
      original_chain_record.referrer_id,
      'referral_chain_continuation',
      original_chain_record.id,
      'referral_chain',
      jsonb_build_object(
        'continued_by', new_referrer_id_param,
        'new_referee', new_referee_id_param
      )
    );
    
    -- Update the original chain status
    UPDATE referral_chains
    SET 
      status = 'chain_continued',
      chain_continued_at = now(),
      updated_at = now()
    WHERE id = original_chain_record.id;
  END IF;
  
  -- Award points to the new referrer for making their first referral
  self_referral_points := award_points(
    new_referrer_id_param,
    'self_referral',
    NULL,
    'self_action',
    jsonb_build_object('first_referral', new_referee_id_param)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'continuation_points', continuation_points,
    'self_referral_points', self_referral_points,
    'original_referrer_id', original_chain_record.referrer_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_point_value(text) TO public;
GRANT EXECUTE ON FUNCTION award_points(uuid, text, uuid, text, jsonb) TO public;
GRANT EXECUTE ON FUNCTION process_referral_code_entry(text, uuid) TO public;
GRANT EXECUTE ON FUNCTION process_social_connection(uuid, text, text, text) TO public;
GRANT EXECUTE ON FUNCTION process_chain_continuation(uuid, uuid) TO public;