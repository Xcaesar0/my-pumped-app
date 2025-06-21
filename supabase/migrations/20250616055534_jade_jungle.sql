/*
  # Create Referral System

  1. New Tables
    - `referrals`
      - `id` (uuid, primary key)
      - `referrer_id` (uuid, references users)
      - `referred_id` (uuid, references users)
      - `referral_code` (text, unique)
      - `created_at` (timestamp)
      - `points_awarded` (integer)
      - `status` (text, default 'pending')
    
    - `user_tasks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `task_type` (text)
      - `task_target` (integer)
      - `current_progress` (integer)
      - `completed` (boolean)
      - `completed_at` (timestamp)
      - `points_earned` (integer)

  2. Updates
    - Add `referral_code` to users table
    - Add indexes for performance
    - Add RLS policies

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for CRUD operations
*/

-- Add referral_code to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE users ADD COLUMN referral_code text UNIQUE;
  END IF;
END $$;

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  points_awarded integer DEFAULT 100,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  UNIQUE(referrer_id, referred_id)
);

-- Create user_tasks table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_type ON user_tasks(task_type);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can read their own referrals"
  ON referrals
  FOR SELECT
  TO public
  USING (referrer_id = auth.uid()::uuid OR referred_id = auth.uid()::uuid);

CREATE POLICY "Users can insert referrals"
  ON referrals
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own referrals"
  ON referrals
  FOR UPDATE
  TO public
  USING (referrer_id = auth.uid()::uuid);

-- RLS Policies for user_tasks
CREATE POLICY "Users can read their own tasks"
  ON user_tasks
  FOR SELECT
  TO public
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can insert their own tasks"
  ON user_tasks
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their own tasks"
  ON user_tasks
  FOR UPDATE
  TO public
  USING (user_id = auth.uid()::uuid);

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code(user_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
BEGIN
  -- Generate a unique referral code
  code := upper(substring(user_id_param::text from 1 for 8) || to_char(extract(epoch from now())::integer, 'FM999999'));
  RETURN code;
END;
$$;

-- Function to initialize user tasks
CREATE OR REPLACE FUNCTION initialize_user_tasks(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert default tasks for new user
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

-- Function to update task progress
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
    AND r.status = 'completed'
    AND sc.platform = 'telegram' -- Only count users who linked X account
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

-- Trigger to update referral code on user creation
CREATE OR REPLACE FUNCTION set_user_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set referral code if not already set
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new users
DROP TRIGGER IF EXISTS trigger_set_referral_code ON users;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_referral_code();

-- Trigger to initialize tasks for new users
CREATE OR REPLACE FUNCTION trigger_initialize_user_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Initialize tasks for new user
  PERFORM initialize_user_tasks(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_init_user_tasks ON users;
CREATE TRIGGER trigger_init_user_tasks
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_user_tasks();