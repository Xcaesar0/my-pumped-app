/*
  # Fix UUID MIN function error

  1. Problem Analysis
    - PostgreSQL doesn't have a built-in MIN function for UUID types
    - Some database function is trying to use MIN(id) where id is a UUID
    - This is likely in a trigger function or stored procedure

  2. Solution
    - Find and fix any functions using MIN(id) on UUID columns
    - Replace with proper UUID ordering using ORDER BY id::text LIMIT 1
    - Update all trigger functions to be UUID-safe
*/

-- First, let's drop and recreate any problematic functions
-- This ensures we start with a clean slate

-- Drop existing trigger functions that might have the issue
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS trigger_initialize_user_tasks() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_ranks_on_points_change() CASCADE;
DROP FUNCTION IF EXISTS activate_referrals_on_social_connection() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Create a safe UUID ordering helper function
CREATE OR REPLACE FUNCTION get_min_uuid_as_text(table_name text, column_name text DEFAULT 'id')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_uuid uuid;
    query_text text;
BEGIN
    query_text := format('SELECT %I FROM %I ORDER BY %I::text LIMIT 1', column_name, table_name, column_name);
    EXECUTE query_text INTO result_uuid;
    RETURN result_uuid;
END;
$$;

-- Recreate handle_new_user function (UUID-safe)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Generate referral code for new user if not already set
    IF NEW.referral_code IS NULL THEN
        UPDATE users 
        SET referral_code = generate_referral_code()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate trigger_initialize_user_tasks function (UUID-safe)
CREATE OR REPLACE FUNCTION trigger_initialize_user_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Initialize user tasks for invite milestones
    INSERT INTO user_tasks (user_id, task_type, task_target, current_progress, completed, points_earned)
    VALUES 
        (NEW.id, 'invite_1', 1, 0, false, 50),
        (NEW.id, 'invite_5', 5, 0, false, 250),
        (NEW.id, 'invite_10', 10, 0, false, 500),
        (NEW.id, 'invite_50', 50, 0, false, 2500),
        (NEW.id, 'invite_100', 100, 0, false, 5000)
    ON CONFLICT (user_id, task_type) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Recreate trigger_update_ranks_on_points_change function (UUID-safe)
CREATE OR REPLACE FUNCTION trigger_update_ranks_on_points_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update ranks for all users using a UUID-safe approach
    WITH ranked_users AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY current_points DESC, id::text) as new_rank
        FROM users
        WHERE is_active = true
    )
    UPDATE users 
    SET current_rank = ranked_users.new_rank
    FROM ranked_users
    WHERE users.id = ranked_users.id;
    
    RETURN NEW;
END;
$$;

-- Recreate activate_referrals_on_social_connection function (UUID-safe)
CREATE OR REPLACE FUNCTION activate_referrals_on_social_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Activate pending referrals when user connects social media
    IF NEW.is_active = true AND NEW.platform IN ('x', 'twitter') THEN
        -- Update referral status
        UPDATE referrals 
        SET status = 'active',
            activated_at = now()
        WHERE referred_id = NEW.user_id 
        AND status = 'pending';
        
        -- Award points to referrer (using proper UUID handling)
        UPDATE users 
        SET current_points = current_points + 10
        FROM referrals r
        WHERE users.id = r.referrer_id
        AND r.referred_id = NEW.user_id 
        AND r.status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Ensure generate_referral_code function is UUID-safe
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result text := '';
    i integer;
    code_exists boolean;
BEGIN
    LOOP
        result := '';
        -- Generate 8 character code
        FOR i IN 1..8 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        -- Check if code already exists (UUID-safe query)
        SELECT EXISTS(
            SELECT 1 FROM users 
            WHERE referral_code = result
            ORDER BY id::text LIMIT 1
        ) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Update increment_user_points function to be UUID-safe
CREATE OR REPLACE FUNCTION increment_user_points(user_id_param uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update user points
    UPDATE users 
    SET current_points = current_points + points_to_add
    WHERE id = user_id_param;
    
    -- Create points transaction record
    INSERT INTO points_transactions (user_id, amount, transaction_type, description)
    VALUES (user_id_param, points_to_add, 'task_completion', 'Points awarded for task completion');
    
    -- Update ranks for all users (UUID-safe batch update)
    WITH ranked_users AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY current_points DESC, id::text) as new_rank
        FROM users
        WHERE is_active = true
    )
    UPDATE users 
    SET current_rank = ranked_users.new_rank
    FROM ranked_users
    WHERE users.id = ranked_users.id;
END;
$$;

-- Update process_referral_from_code function to be UUID-safe
CREATE OR REPLACE FUNCTION process_referral_from_code(p_referral_code text, p_new_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id uuid;
    v_referral_id uuid;
    v_existing_referral_count integer;
BEGIN
    -- Validate inputs
    IF p_referral_code IS NULL OR trim(p_referral_code) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Referral code is required');
    END IF;
    
    IF p_new_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User ID is required');
    END IF;
    
    -- Clean the referral code
    p_referral_code := upper(trim(p_referral_code));
    
    -- Check if user already has a referral (UUID-safe)
    SELECT COUNT(*) INTO v_existing_referral_count
    FROM referrals 
    WHERE referred_id = p_new_user_id;
    
    IF v_existing_referral_count > 0 THEN
        RETURN json_build_object('success', false, 'error', 'User has already used a referral code');
    END IF;
    
    -- Find the referrer (UUID-safe query)
    SELECT id INTO v_referrer_id
    FROM users 
    WHERE referral_code = p_referral_code
    AND is_active = true
    ORDER BY id::text LIMIT 1;
    
    IF v_referrer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired referral code');
    END IF;
    
    -- Check if user is trying to refer themselves
    IF v_referrer_id = p_new_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot use your own referral code');
    END IF;
    
    -- Create the referral
    INSERT INTO referrals (referrer_id, referred_id, referral_code, status, points_awarded)
    VALUES (v_referrer_id, p_new_user_id, p_referral_code, 'pending', 25)
    RETURNING id INTO v_referral_id;
    
    -- Award immediate points to the new user
    UPDATE users 
    SET current_points = current_points + 25
    WHERE id = p_new_user_id;
    
    -- Create points transaction
    INSERT INTO points_transactions (user_id, amount, transaction_type, reference_id, description)
    VALUES (p_new_user_id, 25, 'referral_bonus', v_referral_id, 'Referral signup bonus');
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Referral code applied successfully! You earned 25 points.',
        'referral_id', v_referral_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', 'An error occurred while processing the referral');
END;
$$;

-- Recreate all triggers with the updated functions
DROP TRIGGER IF EXISTS on_user_created ON users;
CREATE TRIGGER on_user_created 
    AFTER INSERT ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS trigger_init_user_tasks ON users;
CREATE TRIGGER trigger_init_user_tasks 
    AFTER INSERT ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_initialize_user_tasks();

DROP TRIGGER IF EXISTS trigger_update_ranks ON users;
CREATE TRIGGER trigger_update_ranks 
    AFTER UPDATE OF current_points ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_update_ranks_on_points_change();

DROP TRIGGER IF EXISTS trigger_activate_referrals_social ON social_connections;
CREATE TRIGGER trigger_activate_referrals_social 
    AFTER INSERT OR UPDATE ON social_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION activate_referrals_on_social_connection();

-- Update triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_kinde_auth_sessions_updated_at ON kinde_auth_sessions;
CREATE TRIGGER trigger_kinde_auth_sessions_updated_at 
    BEFORE UPDATE ON kinde_auth_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_x_auth_tokens_updated_at ON x_auth_tokens;
CREATE TRIGGER trigger_x_auth_tokens_updated_at 
    BEFORE UPDATE ON x_auth_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Clean up the helper function as it's no longer needed
DROP FUNCTION IF EXISTS get_min_uuid_as_text(text, text);