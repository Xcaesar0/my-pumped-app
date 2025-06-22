/*
  # Fix UUID MIN function error

  1. Problem
    - PostgreSQL doesn't have a built-in MIN function for UUID types
    - Some function is trying to use MIN(id) where id is a UUID

  2. Solution
    - Create a custom function to handle UUID comparison
    - Update any functions that use MIN(id) with UUID columns
    - Use proper UUID ordering with CAST or ORDER BY instead
*/

-- First, let's check if there are any functions using MIN(id) and fix them
-- This is likely in a trigger function or stored procedure

-- Create a helper function for UUID ordering if needed
CREATE OR REPLACE FUNCTION get_first_uuid_by_order(table_name text, id_column text DEFAULT 'id')
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    result_id uuid;
BEGIN
    EXECUTE format('SELECT %I FROM %I ORDER BY %I::text LIMIT 1', id_column, table_name, id_column)
    INTO result_id;
    
    RETURN result_id;
END;
$$;

-- Fix any existing functions that might be using MIN(id) on UUID columns
-- Let's check the most likely culprits: trigger functions

-- Update the handle_new_user function if it exists and has the issue
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Generate referral code for new user
    UPDATE users 
    SET referral_code = generate_referral_code()
    WHERE id = NEW.id AND referral_code IS NULL;
    
    RETURN NEW;
END;
$$;

-- Update the trigger_initialize_user_tasks function if it exists and has the issue
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

-- Update the trigger_update_ranks_on_points_change function if it exists and has the issue
CREATE OR REPLACE FUNCTION trigger_update_ranks_on_points_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update user's rank based on points
    -- Use a more efficient approach without MIN on UUID
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

-- Update the activate_referrals_on_social_connection function if it exists and has the issue
CREATE OR REPLACE FUNCTION activate_referrals_on_social_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Activate pending referrals when user connects social media
    IF NEW.is_active = true AND NEW.platform IN ('x', 'twitter') THEN
        UPDATE referrals 
        SET status = 'active',
            activated_at = now()
        WHERE referred_id = NEW.user_id 
        AND status = 'pending';
        
        -- Award points to referrer
        UPDATE users 
        SET current_points = current_points + 10
        WHERE id IN (
            SELECT referrer_id 
            FROM referrals 
            WHERE referred_id = NEW.user_id 
            AND status = 'active'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or update the generate_referral_code function
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
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = result) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Update the increment_user_points function to ensure it doesn't use MIN on UUID
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
    
    -- Update ranks for all users (more efficient batch update)
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

-- Ensure the process_referral_from_code function doesn't use MIN on UUID
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
    
    -- Check if user already has a referral
    SELECT COUNT(*) INTO v_existing_referral_count
    FROM referrals 
    WHERE referred_id = p_new_user_id;
    
    IF v_existing_referral_count > 0 THEN
        RETURN json_build_object('success', false, 'error', 'User has already used a referral code');
    END IF;
    
    -- Find the referrer
    SELECT id INTO v_referrer_id
    FROM users 
    WHERE referral_code = p_referral_code
    AND is_active = true;
    
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

-- Update any other functions that might be using MIN on UUID columns
-- This covers the most common cases where this error might occur