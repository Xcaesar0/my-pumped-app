/*
  # Fix RLS policies to use auth.uid() instead of uid()

  1. Policy Updates
    - Update all RLS policies that use uid() to use auth.uid() instead
    - This fixes the "function uid() does not exist" error
    - Affects policies on: social_links, points_transactions, user_task_submissions, x_auth_tokens, user_notifications

  2. Security
    - Maintains the same security model but with proper function references
    - Ensures policies work correctly for authenticated users
*/

-- Fix social_links policies
ALTER POLICY "Users can insert their own social links" ON public.social_links
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users can read their own social links" ON public.social_links
  USING (user_id = auth.uid());

ALTER POLICY "Users can update their own social links" ON public.social_links
  USING (user_id = auth.uid());

-- Fix points_transactions policies
ALTER POLICY "Users can read their own point transactions" ON public.points_transactions
  USING (user_id = auth.uid());

-- Fix user_task_submissions policies
ALTER POLICY "Users can create their own submissions" ON public.user_task_submissions
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Users can update their own pending submissions" ON public.user_task_submissions
  USING ((auth.uid() = user_id) AND (status = 'pending'::text));

ALTER POLICY "Users can view their own submissions" ON public.user_task_submissions
  USING (auth.uid() = user_id);

-- Fix x_auth_tokens policies
ALTER POLICY "Users can read their own X tokens" ON public.x_auth_tokens
  USING (user_id = auth.uid());

-- Fix user_notifications policies (these were too permissive before)
ALTER POLICY "Users can insert their own notifications" ON public.user_notifications
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Users can read their own notifications" ON public.user_notifications
  USING (user_id = auth.uid());

ALTER POLICY "Users can update their own notifications" ON public.user_notifications
  USING (user_id = auth.uid());