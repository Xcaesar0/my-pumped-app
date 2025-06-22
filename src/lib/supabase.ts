import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Check if environment variables are properly configured
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`
    Missing Supabase environment variables. 
    
    Please set up your Supabase connection by:
    1. Creating a .env file from .env.example
    2. Adding your actual Supabase credentials:
       - VITE_SUPABASE_URL=your_supabase_url
       - VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    3. You can find these values in your Supabase project settings under 'API'
    4. Restart your development server after updating the .env file
  `)
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch (error) {
  throw new Error(`
    Invalid Supabase URL format: ${supabaseUrl}
    
    Please ensure your VITE_SUPABASE_URL is a valid URL (e.g., https://your-project.supabase.co)
  `)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface User {
  id: string
  wallet_address: string
  username: string
  connection_timestamp: string
  current_points: number
  current_rank: number
  referral_code?: string
  x_connected_at?: string
  is_active?: boolean
  kinde_user_id?: string
  points?: number
}

export interface Task {
  id: string
  user_id: string
  task_type: 'invite_1' | 'invite_5' | 'invite_10' | 'invite_50' | 'invite_100'
  task_target: number
  current_progress: number
  completed: boolean
  completed_at?: string
  points_earned: number
  created_at: string
}

export interface LeaderboardEntry {
  username: string
  points: number
  referrals?: number
  rank: number
}

export interface SocialConnection {
  id: string
  user_id: string
  platform: 'telegram' | 'x'
  platform_user_id: string
  platform_username: string
  connected_at: string
  is_active: boolean
  auth_provider?: string
  kinde_connection_id?: string
  provider_metadata?: any
}

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string
  referral_code: string
  created_at: string
  points_awarded: number
  status: 'pending' | 'completed' | 'cancelled' | 'active' | 'expired' | 'invalid'
  activated_at?: string
  expires_at?: string
}

// Twitter (X) Authentication via Supabase
export const signInWithTwitter = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  })

  if (error) {
    console.error('Error signing in with Twitter:', error)
    throw error
  }

  return data
}

// Social media integration functions
export const getSocialConnections = async (userId: string): Promise<SocialConnection[]> => {
  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching social connections:', error)
    return []
  }

  return data || []
}

export const createSocialConnection = async (connection: Omit<SocialConnection, 'id' | 'connected_at'>): Promise<SocialConnection> => {
  console.log('Creating social connection:', connection)
  
  const { data, error } = await supabase
    .from('social_connections')
    .upsert({
      ...connection,
      connected_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,platform'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating social connection:', error)
    throw new Error(`Failed to create social connection: ${error.message}`)
  }

  console.log('Social connection created successfully:', data)
  return data
}

export const updateSocialConnection = async (id: string, updates: Partial<SocialConnection>): Promise<SocialConnection> => {
  const { data, error } = await supabase
    .from('social_connections')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating social connection:', error)
    throw new Error(error.message)
  }

  return data
}

export const deleteSocialConnection = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting social connection:', error)
    throw new Error(error.message)
  }
}

// User functions
export const getUserByUsername = async (username: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const getUserByReferralCode = async (referralCode: string): Promise<User | null> => {
  console.log('Searching for user with referral code:', referralCode)
  
  // Clean the referral code to only contain A-Z and 0-9
  const cleanCode = referralCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('referral_code', cleanCode)
    .maybeSingle()

  if (error) {
    console.error('Error finding user by referral code:', error)
    throw error
  }
  
  console.log('Found user by referral code:', data?.username || 'none')
  return data
}

// Referral system functions
export const createReferral = async (referrerId: string, referredId: string, referralCode: string): Promise<Referral> => {
  const { data, error } = await supabase
    .from('referrals')
    .insert([{
      referrer_id: referrerId,
      referred_id: referredId,
      referral_code: referralCode,
      points_awarded: 10,
      status: 'pending'
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export const getReferralByUserId = async (userId: string): Promise<Referral | null> => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*, referrer:users!referrer_id(username)')
    .eq('referred_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

// Process referral from code with proper error handling
export const processReferralFromCode = async (referralCode: string, newUserId: string): Promise<{ success: boolean; error?: string; referral_id?: string; message?: string }> => {
  try {
    console.log('Processing referral code:', referralCode, 'for user:', newUserId)
    
    // Clean the referral code to only contain A-Z and 0-9
    const cleanCode = referralCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
    
    // Call the database function
    const { data, error } = await supabase.rpc('process_referral_from_code', {
      p_referral_code: cleanCode,
      p_new_user_id: newUserId
    })

    if (error) {
      console.error('Database error processing referral code:', error)
      return { 
        success: false, 
        error: error.message || 'Failed to process referral code' 
      }
    }

    console.log('Referral processing result:', data)
    
    // Handle the response
    if (data === null || data === undefined) {
      console.warn('Database function returned null/undefined')
      return { 
        success: false, 
        error: 'No response from referral processing function' 
      }
    }
    
    // Return the data as-is since it should be a JSON object
    return data as { success: boolean; error?: string; referral_id?: string; message?: string }
  } catch (error) {
    console.error('Error processing referral from code:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process referral code' 
    }
  }
}

// Function to validate referral code format (A-Z and 0-9 only, 6-12 characters)
export const validateReferralCode = (code: string): boolean => {
  if (!code) return false
  // Clean the code first
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Check if cleaned code is between 6-12 characters and contains only A-Z and 0-9
  const alphanumericRegex = /^[A-Z0-9]{6,12}$/
  return alphanumericRegex.test(cleanCode) && cleanCode.length >= 6 && cleanCode.length <= 12
}

// Referral tracking functions
export const trackReferralClick = async (referralCode: string, ipAddress?: string, userAgent?: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('track_referral_click', {
    referral_code_param: referralCode,
    ip_address_param: ipAddress,
    user_agent_param: userAgent
  })

  if (error) throw error
  return data
}

// Leaderboard functions
export const getLeaderboard = async (limit: number = 100): Promise<LeaderboardEntry[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('username, current_points')
    .order('current_points', { ascending: false })
    .limit(limit)

  if (error) throw error
  
  return (data || []).map((user, index) => ({
    username: user.username,
    points: user.current_points,
    rank: index + 1
  }))
}

export const getReferralLeaderboard = async (limit: number = 100): Promise<LeaderboardEntry[]> => {
  try {
    // Try to use the RPC function first
    const { data, error } = await supabase.rpc('get_top_referrers', {
      limit_count: limit
    })

    if (error) {
      console.warn('RPC get_top_referrers not available, using fallback')
      
      // Fallback: manually calculate referral counts
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username, current_points')
        .order('current_points', { ascending: false })
        .limit(limit)

      const referrersWithCounts = await Promise.all(
        (usersData || []).map(async (user, index) => {
          const { count } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', user.id)
            .eq('status', 'active')

          return {
            username: user.username,
            points: user.current_points,
            referrals: count || 0,
            rank: index + 1
          }
        })
      )

      return referrersWithCounts.sort((a, b) => b.referrals - a.referrals)
    }

    return data || []
  } catch (error) {
    console.error('Error loading referral leaderboard:', error)
    return []
  }
}

export const getUserRank = async (userId: string): Promise<number> => {
  const { data: user } = await supabase
    .from('users')
    .select('current_points')
    .eq('id', userId)
    .single()

  if (!user) return 0

  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('current_points', user.current_points)

  return (count || 0) + 1
}

export const generateReferralCode = (userId: string): string => {
  // Generate a unique referral code using only A-Z and 0-9
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  // Generate 8 random characters
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return code
}

// Task functions
export const getUserTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export const updateTaskProgress = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('update_task_progress', {
    user_id_param: userId
  })

  if (error) throw error
}