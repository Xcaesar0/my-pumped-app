import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface UserStats {
  totalReferrals: number
  bonusReferrals: number
  totalPoints: number
  bonusPoints: number
  globalRank: number
  referredBy?: string
  pointsFromReferrals: number
  pointsFromSocial: number
  pointsFromChain: number
}

export interface LeaderboardEntry {
  username: string
  points: number
  referrals: number
  rank: number
}

export interface BountyTask {
  id: string
  title: string
  description: string
  platform: 'x' | 'telegram' | 'general'
  points: number
  status: 'not_started' | 'in_progress' | 'verifying' | 'completed'
  action_url?: string
  verification_type: 'manual' | 'api' | 'social'
  requires_connection?: boolean
}

export interface BountyTasksData {
  active: BountyTask[]
  completed: BountyTask[]
}

export const useBountyData = (walletAddress: string | null) => {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [bountyTasks, setBountyTasks] = useState<BountyTasksData>({ active: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserId = async () => {
      if (!walletAddress) {
        setUserId(null)
        return
      }
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();
      if (user && user.id) {
        setUserId(user.id);
      } else {
        setUserId(null);
      }
    };
    fetchUserId();
  }, [walletAddress]);

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId]);

  const loadAllData = async () => {
    setLoading(true)
    setError(null)

    try {
      await Promise.all([
        loadUserStats(),
        loadLeaderboard(),
        loadBountyTasks()
      ])
    } catch (err) {
      console.error('Error loading bounty data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async () => {
    if (!userId) {
      console.warn('Invalid userId provided to loadUserStats')
      return
    }

    try {
      // Get user's current data by userId
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('current_points, current_rank')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get referral count (people this user has referred)
      const { count: referralCount } = await supabase
        .from('referral_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId)

      // Get referrer info (who referred this user)
      const { data: referralData } = await supabase
        .from('referral_tracking')
        .select('referrer:users!referrer_id(username)')
        .eq('referee_id', userId)
        .maybeSingle()

      // Calculate global rank
      const { count: higherRankedCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('current_points', user.current_points)

      const globalRank = (higherRankedCount || 0) + 1

      // Get point breakdown from point_awards
      const { data: pointAwards } = await supabase
        .from('point_awards')
        .select('award_type, points_awarded')
        .eq('user_id', userId)

      let pointsFromReferrals = 0
      let pointsFromSocial = 0
      let pointsFromChain = 0

      pointAwards?.forEach(award => {
        if (award.award_type.includes('referral_code_entry') || award.award_type.includes('social_connection')) {
          pointsFromReferrals += award.points_awarded
        } else if (award.award_type.includes('twitter_connection') || award.award_type.includes('telegram_connection')) {
          pointsFromSocial += award.points_awarded
        } else if (award.award_type.includes('chain_continuation') || award.award_type.includes('self_referral')) {
          pointsFromChain += award.points_awarded
        }
      })

      setUserStats({
        totalReferrals: referralCount || 0,
        bonusReferrals: 0, // TODO: Implement bonus referrals logic if needed
        totalPoints: user.current_points || 0,
        bonusPoints: pointsFromReferrals + pointsFromSocial + pointsFromChain,
        globalRank,
        referredBy: (referralData?.referrer as any)?.username,
        pointsFromReferrals,
        pointsFromSocial,
        pointsFromChain
      })
    } catch (error) {
      console.error('Error loading user stats:', error)
      throw error
    }
  }

  const loadLeaderboard = async () => {
    try {
      // Get top points holders with referral counts
      const { data: leaderboardData, error } = await supabase
        .from('users')
        .select(`
          username,
          current_points,
          id
        `)
        .order('current_points', { ascending: false })
        .order('id', { ascending: true }) // Consistent tiebreaker
        .limit(50)

      if (error) throw error

      // Get referral counts for each user
      const leaderboardWithReferrals = await Promise.all(
        (leaderboardData || []).map(async (user, index) => {
          const { count: referralCount } = await supabase
            .from('referral_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', user.id)

          return {
            username: user.username,
            points: user.current_points || 0,
            referrals: referralCount || 0,
            rank: index + 1
          }
        })
      )

      setLeaderboard(leaderboardWithReferrals)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
      throw error
    }
  }

  const loadBountyTasks = async () => {
    if (!userId) {
      console.warn('Invalid userId provided to loadBountyTasks')
      return
    }

    try {
      // Check user's social connections
      const { data: socialConnections } = await supabase
        .from('social_connections')
        .select('platform, platform_username')
        .eq('user_id', userId)
        .eq('is_active', true)

      const connectedPlatforms = socialConnections?.map(conn => conn.platform) || []
      const xUsername = socialConnections?.find(conn => conn.platform === 'x')?.platform_username || ''

      // Get user data for username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('Error loading user data:', userError)
        throw userError
      }

      // Try to fetch completed tasks from user_task_submissions
      let completedTasksFromSubmissions: string[] = []
      try {
        const { data: submissions, error: submissionsError } = await supabase
          .from('user_task_submissions')
          .select('admin_task_id, status')
          .eq('user_id', userId)
          .eq('status', 'approved')

        if (!submissionsError && submissions) {
          completedTasksFromSubmissions = submissions.map(sub => sub.admin_task_id)
        }
      } catch (error) {
        console.error('Error loading user task submissions:', error)
        // Continue execution even if this fails
      }

      // Try to fetch admin tasks
      let adminTasksMap: Record<string, any> = {}
      try {
        const { data: adminTasks, error: adminTasksError } = await supabase
          .from('admin_tasks')
          .select('id, title, platform')

        if (!adminTasksError && adminTasks) {
          adminTasksMap = adminTasks.reduce((acc, task) => {
            acc[task.id] = task
            return acc
          }, {} as Record<string, any>)
        }
      } catch (error) {
        console.error('Error loading admin tasks:', error)
        // Continue execution even if this fails
      }

      // Fetch completed X tasks from x_task_completions
      const { data: xCompletions, error: xCompletionsError } = await supabase
        .from('x_task_completions')
        .select('task_title')
        .eq('user_id', userId)

      if (xCompletionsError) {
        console.error('Error loading x_task_completions:', xCompletionsError)
      }
      
      const completedXTaskTitles = xCompletions?.map(x => x.task_title) || []
      console.log('Completed X task titles:', completedXTaskTitles)

      // Define available tasks
      const allTasks: BountyTask[] = [
        {
          id: 'join_telegram',
          title: 'Join Telegram',
          description: 'Join our official Telegram community',
          platform: 'telegram',
          points: 25,
          status: 'not_started',
          action_url: 'https://t.me/pumpeddotfun',
          verification_type: 'manual',
          requires_connection: true
        },
        {
          id: 'follow_x',
          title: 'Follow @pumpeddotfun',
          description: 'Follow @pumpeddotfun on X (Twitter)',
          platform: 'x',
          points: 25,
          status: 'not_started',
          action_url: 'https://x.com/pumpeddotfun',
          verification_type: 'manual',
          requires_connection: true
        },
        {
          id: 'repost_launch',
          title: 'Repost Launch Post',
          description: 'Repost our latest launch announcement',
          platform: 'x',
          points: 50,
          status: 'not_started',
          action_url: 'https://x.com/pumpeddotfun/status/123456789',
          verification_type: 'manual',
          requires_connection: true
        }
      ]

      // Update task statuses based on DB completions and user's connections
      const updatedTasks = allTasks.map(task => {
        // Check if task is completed based on X task completions
        if (task.platform === 'x' && completedXTaskTitles.includes(task.title)) {
          return { ...task, status: 'completed' as const }
        }
        
        // Check if task is completed based on user_task_submissions
        // This would require mapping task.id to admin_task_id which we don't have
        // For now, we'll just check if the user has the required connection for auto-completion
        if (task.platform === 'telegram' && connectedPlatforms.includes('telegram')) {
          return { ...task, status: 'completed' as const }
        }
        
        return task
      })

      setBountyTasks({
        active: updatedTasks.filter(task => task.status !== 'completed'),
        completed: updatedTasks.filter(task => task.status === 'completed')
      })
    } catch (error) {
      console.error('Error loading bounty tasks:', error)
      throw error
    }
  }

  const beginTask = async (taskId: string) => {
    try {
      setBountyTasks(prev => ({
        ...prev,
        active: prev.active.map(task =>
          task.id === taskId ? { ...task, status: 'in_progress' } : task
        )
      }))

      // Find the task and open its action URL
      const task = bountyTasks.active.find(t => t.id === taskId)
      if (task?.action_url) {
        window.open(task.action_url, '_blank')
      }
    } catch (error) {
      console.error('Error beginning task:', error)
    }
  }

  const verifyTask = async (taskId: string, xUsername?: string) => {
    try {
      const task = bountyTasks.active.find(t => t.id === taskId)
      if (!task) return { success: false, message: 'Task not found' }

      setBountyTasks(prev => ({
        ...prev,
        active: prev.active.map(task =>
          task.id === taskId ? { ...task, status: 'verifying' } : task
        )
      }))

      // 1. Fetch user info (username) and user_id
      if (!userId) {
        setBountyTasks(prev => ({
          ...prev,
          active: prev.active.map(task =>
            task.id === taskId ? { ...task, status: 'in_progress' } : task
          )
        }))
        return { success: false, message: 'User not found.' }
      }
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single()

      if (userError || !userData) {
        setBountyTasks(prev => ({
          ...prev,
          active: prev.active.map(task =>
            task.id === taskId ? { ...task, status: 'in_progress' } : task
          )
        }))
        return { success: false, message: 'Could not verify task. Please try again.' }
      }

      // Get X username from social connections
      const { data: xConnection, error: xConnectionError } = await supabase
        .from('social_connections')
        .select('platform_username')
        .eq('user_id', userId)
        .eq('platform', 'x')
        .eq('is_active', true)
        .maybeSingle()

      if (xConnectionError) {
        console.error('Error fetching X connection:', xConnectionError)
      }

      const xUsernameToUse = xUsername || xConnection?.platform_username || 'unknown'
      console.log('X username for task completion:', xUsernameToUse)

      // 2. Insert into x_task_completions
      const { error: xTaskError } = await supabase
        .from('x_task_completions')
        .insert([
          {
            user_id: userId,
            username: userData.username,
            x_username: xUsernameToUse,
            task_title: task.title,
            completed_at: new Date().toISOString()
          }
        ])

      if (xTaskError) {
        console.error('Error inserting X task completion:', xTaskError)
        setBountyTasks(prev => ({
          ...prev,
          active: prev.active.map(task =>
            task.id === taskId ? { ...task, status: 'in_progress' } : task
          )
        }))
        return { success: false, message: 'Could not verify X task. Please try again.' }
      }

      // 3. Mark as completed in UI and award points
      setBountyTasks(prev => ({
        active: prev.active.filter(t => t.id !== taskId),
        completed: [...prev.completed, { ...task, status: 'completed' }]
      }))

      // Award points to the user
      const { error: pointsError } = await supabase.rpc('increment_user_points', {
        user_id_param: userId,
        points_to_add: task.points
      })

      if (pointsError) {
        console.error('Failed to award points:', pointsError)
      }

      await loadUserStats()
      return { success: true, message: `Task completed! You earned ${task.points} points.` }
    } catch (error) {
      console.error('Error verifying task:', error)
      setBountyTasks(prev => ({
        ...prev,
        active: prev.active.map(task =>
          task.id === taskId ? { ...task, status: 'in_progress' } : task
        )
      }))
      return { success: false, message: 'An error occurred.' }
    }
  }

  const refreshData = async () => {
    await loadAllData()
  }

  return {
    userStats,
    leaderboard,
    bountyTasks,
    loading,
    error,
    refreshData,
    beginTask,
    verifyTask,
    isAuthenticated: !!walletAddress
  }
}