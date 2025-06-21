/*
  # Add atomic point increment function

  1. New Functions
    - `increment_user_points` - Safely increment user points atomically
    - This prevents race conditions when multiple operations try to update points simultaneously

  2. Security
    - Function uses SECURITY DEFINER to ensure proper permissions
    - Validates user exists before updating
*/

-- Create function to atomically increment user points
CREATE OR REPLACE FUNCTION increment_user_points(user_id_param uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user points atomically
  UPDATE users 
  SET current_points = current_points + points_to_add
  WHERE id = user_id_param;
  
  -- Check if user was found and updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id_param;
  END IF;
END;
$$;