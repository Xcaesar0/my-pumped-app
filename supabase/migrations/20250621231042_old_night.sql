/*
  # Remove admin_tasks and related tables

  1. Tables to Remove
    - `admin_tasks` - Main admin tasks table
    - `user_task_submissions` - User submissions for admin tasks
  
  2. Security
    - Drop all related policies and triggers
    - Clean up any foreign key references
  
  3. Changes
    - Remove admin_tasks table completely
    - Remove user_task_submissions table completely
    - Clean up any related functions or triggers
*/

-- Drop user_task_submissions table first (has foreign key to admin_tasks)
DROP TABLE IF EXISTS user_task_submissions CASCADE;

-- Drop admin_tasks table
DROP TABLE IF EXISTS admin_tasks CASCADE;

-- Drop the update function for admin_tasks if it exists
DROP FUNCTION IF EXISTS update_admin_tasks_updated_at() CASCADE;