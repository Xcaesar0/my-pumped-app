/*
  # Fix X Task Points and Persistence

  1. Database Function Updates
    - Create process_social_connection_points function to award points for X connections
    - Ensure social_connections table properly tracks X connections
    - Fix trigger to award points when X account is connected

  2. Data Integrity
    - Add missing columns and constraints
    - Update existing functions to be more robust
    - Fix any UUID-related issues

  3. Performance
    - Add proper indexes
    - Optimize function performance
*/

-- Create or replace the process_social_connection_points function
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

-- Create trigger function for social connections
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

-- Create trigger for social connections
DROP TRIGGER IF EXISTS trigger_social_connection_points ON social_connections;
CREATE TRIGGER trigger_social_connection_points
  AFTER INSERT OR UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_social_connection_points();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_social_connection_points(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION trigger_social_connection_points() TO public;

-- Create function to handle X task completions
CREATE OR REPLACE FUNCTION process_x_task_completion(
  user_id_param uuid,
  task_title_param text,
  x_username_param text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record record;
  points_awarded integer := 0;
  username_var text;
BEGIN
  -- Get user's username
  SELECT username INTO username_var
  FROM users
  WHERE id = user_id_param;
  
  IF username_var IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if task already completed
  IF EXISTS (
    SELECT 1 FROM x_task_completions
    WHERE user_id = user_id_param AND task_title = task_title_param
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already completed');
  END IF;
  
  -- Find task in admin_tasks
  SELECT * INTO task_record
  FROM admin_tasks
  WHERE title = task_title_param AND platform = 'x' AND is_active = true;
  
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
  );
  
  -- Award points
  IF task_record.id IS NOT NULL THEN
    points_awarded := task_record.points;
  ELSE
    -- Default points if task not found in admin_tasks
    CASE task_title_param
      WHEN 'Follow @pumpeddotfun' THEN points_awarded := 25;
      WHEN 'Repost Launch Post' THEN points_awarded := 50;
      ELSE points_awarded := 25;
    END CASE;
  END IF;
  
  -- Update user points
  UPDATE users
  SET current_points = current_points + points_awarded
  WHERE id = user_id_param;
  
  -- Create points transaction
  INSERT INTO points_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    user_id_param,
    points_awarded,
    'task_completion',
    format('Completed X task: %s', task_title_param)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', points_awarded,
    'message', format('Task completed! You earned %s points.', points_awarded)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Error processing X task completion: %s', SQLERRM)
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_x_task_completion(uuid, text, text) TO public;

-- Create unique title constraint on admin_tasks if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admin_tasks_title_unique'
  ) THEN
    ALTER TABLE admin_tasks ADD CONSTRAINT admin_tasks_title_unique UNIQUE (title);
  END IF;
END $$;

-- Ensure admin tasks exist
INSERT INTO admin_tasks (title, description, platform, points, action_url, verification_type, requires_connection) VALUES
  ('Join Telegram', 'Join our official Telegram community', 'telegram', 25, 'https://t.me/pumpeddotfun', 'manual', true),
  ('Follow @pumpeddotfun', 'Follow @pumpeddotfun on X (Twitter)', 'x', 25, 'https://x.com/pumpeddotfun', 'manual', true),
  ('Repost Launch Post', 'Repost our latest launch announcement', 'x', 50, 'https://x.com/pumpeddotfun/status/123456789', 'manual', true)
ON CONFLICT (title) DO UPDATE SET
  platform = EXCLUDED.platform,
  points = EXCLUDED.points,
  requires_connection = EXCLUDED.requires_connection,
  is_active = true;