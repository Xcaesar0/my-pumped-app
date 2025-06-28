/*
  # Fix X Task Completion Function

  1. Problem
    - The process_x_task_completion function is missing or not working correctly
    - Frontend is getting error when trying to verify X tasks
    - Need to ensure the function exists and works properly

  2. Solution
    - Create or replace the function with proper error handling
    - Ensure it handles task verification and point awards
    - Add unique constraint on user_id + task_title to prevent duplicates
    - Create proper indexes for performance
*/

-- Create or replace the process_x_task_completion function
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
      submission_data,
      reviewed_at
    ) VALUES (
      user_id_param,
      task_id,
      'approved',
      jsonb_build_object(
        'x_username', x_username_param,
        'task_title', task_title_param,
        'completion_id', completion_id
      ),
      now()
    )
    ON CONFLICT (user_id, admin_task_id) 
    DO UPDATE SET 
      status = 'approved',
      reviewed_at = now(),
      submission_data = jsonb_build_object(
        'x_username', x_username_param,
        'task_title', task_title_param,
        'completion_id', completion_id
      );
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_x_task_completion(text, uuid, text) TO public;

-- Add unique constraint on user_id + task_title to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'x_task_completions_user_task_unique'
  ) THEN
    ALTER TABLE x_task_completions ADD CONSTRAINT x_task_completions_user_task_unique UNIQUE (user_id, task_title);
  END IF;
END $$;

-- Create index for x_task_completions
CREATE INDEX IF NOT EXISTS idx_x_task_completions_user_task ON x_task_completions(user_id, task_title);

-- Create policy for x_task_completions
DROP POLICY IF EXISTS "Public can insert x task completions" ON x_task_completions;
CREATE POLICY "Public can insert x task completions"
  ON x_task_completions
  FOR INSERT
  TO public
  WITH CHECK (true);