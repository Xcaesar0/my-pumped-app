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
      
      try {
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
      } catch (error) {
        console.error('Network error fetching user ID:', error)
        setUserId(null)
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
      const { count: referralCount, error: referralError } = await supabase
        .from('referral_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId)
        
      if (referralError) {
        console.warn('Error fetching referral count:', referralError)
      }

      // Get referrer info (who referred this user)
      const { data: referralData, error: referrerError } = await supabase
        .from('referral_tracking')
        .select('referrer:users!referrer_id(username)')
        .eq('referee_id', userId)
        .maybeSingle()
        
      if (referrerError) {
        console.warn('Error fetching referrer info:', referrerError)
      }

      // Calculate global rank
      const { count: higherRankedCount, error: rankError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('current_points', user.current_points)
        
      if (rankError) {
        console.warn('Error calculating global rank:', rankError)
      }

      const globalRank = (higherRankedCount || 0) + 1

      // Get point breakdown from point_awards
      const { data: pointAwards, error: pointsError } = await supabase
        .from('point_awards')
        .select('award_type, points_awarded')
        .eq('user_id', userId)
        
      if (pointsError) {
        console.warn('Error fetching point awards:', pointsError)
      }

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
          try {
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
          } catch (error) {
            console.warn(`Error fetching referrals for user ${user.id}:`, error)
            return {
              username: user.username,
              points: user.current_points || 0,
              referrals: 0,
              rank: index + 1
            }
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
      const { data: socialConnections, error: socialError } = await supabase
        .from('social_connections')
        .select('platform, platform_username')
        .eq('user_id', userId)
        .eq('is_active', true)
        
      if (socialError) {
        console.warn('Error fetching social connections:', socialError)
      }

      const connectedPlatforms = socialConnections?.map(conn => conn.platform) || []
      const xUsername = socialConnections?.find(conn => conn.platform === 'x')?.platform_username || ''

      // Get user data for username and X connection status
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username, x_connected_at')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('Error loading user data:', userError)
        throw userError
      }

      // If user has x_connected_at timestamp, consider X connected
      if (userData.x_connected_at && !connectedPlatforms.includes('x')) {
        connectedPlatforms.push('x')
      }

      // Fetch completed X tasks from x_task_completions
      let completedXTaskTitles: string[] = []
      try {
        const { data: xCompletions, error: xCompletionsError } = await supabase
          .from('x_task_completions')
          .select('task_title')
          .eq('user_id', userId)

        if (xCompletionsError) {
          console.warn('Error loading x_task_completions:', xCompletionsError)
        } else {
          completedXTaskTitles = xCompletions?.map(x => x.task_title) || []
          console.log('Completed X task titles from database:', completedXTaskTitles)
        }
      } catch (error) {
        console.warn('Network error loading x_task_completions:', error)
      }

      // Fetch completed tasks from user_task_submissions
      let completedTaskIds: string[] = []
      try {
        const { data: taskSubmissions, error: submissionsError } = await supabase
          .from('user_task_submissions')
          .select('admin_task_id')
          .eq('user_id', userId)
          .eq('status', 'approved')
          
        if (submissionsError) {
          console.warn('Error loading user_task_submissions:', submissionsError)
        } else {
          completedTaskIds = taskSubmissions?.map(sub => sub.admin_task_id) || []
          console.log('Completed task IDs from database:', completedTaskIds)
        }
      } catch (error) {
        console.warn('Network error loading user_task_submissions:', error)
      }

      // Fetch all admin tasks
      const { data: adminTasks, error: adminTasksError } = await supabase
        .from('admin_tasks')
        .select('*')
        .eq('is_active', true)
        
      if (adminTasksError) {
        console.warn('Error loading admin_tasks:', adminTasksError)
      }

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

      // Load task statuses from localStorage (only for in-progress tasks)
      const taskStatusesFromStorage = JSON.parse(localStorage.getItem('taskStatuses') || '{}')
      
      console.log('Task statuses from localStorage:', taskStatusesFromStorage)

      // Update task statuses based on DB completions and user's connections
      const updatedTasks = allTasks.map(task => {
        // Check if task is completed based on X task completions
        if (task.platform === 'x' && completedXTaskTitles.includes(task.title)) {
          console.log(`Task ${task.title} is completed based on database record`)
          return { ...task, status: 'completed' as const }
        }
        
        // Check if task is in progress based on localStorage
        if (taskStatusesFromStorage[task.id]) {
          console.log(`Task ${task.title} is ${taskStatusesFromStorage[task.id]} based on localStorage`)
          return { ...task, status: taskStatusesFromStorage[task.id] as any }
        }
        
        // Check if task is completed based on user's connections
        if (task.platform === 'telegram' && connectedPlatforms.includes('telegram')) {
          console.log(`Task ${task.title} is completed based on Telegram connection`)
          return { ...task, status: 'completed' as const }
        }
        
        // Check if task is completed based on admin task submissions
        if (adminTasks) {
          const matchingAdminTask = adminTasks.find(at => at.title === task.title)
          if (matchingAdminTask && completedTaskIds.includes(matchingAdminTask.id)) {
            console.log(`Task ${task.title} is completed based on admin task submission`)
            return { ...task, status: 'completed' as const }
          }
        }
        
        return task
      })

      setBountyTasks({
        active: updatedTasks.filter(task => task.status !== 'completed'),
        completed: updatedTasks.filter(task => task.status === 'completed')
      })
    } catch (error) {
      console.error('Error loading bounty tasks:', error)
      // Don't throw here, just set empty tasks to prevent app crash
      setBountyTasks({ active: [], completed: [] })
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
      
      // Save task status to localStorage to persist between refreshes
      const taskStatuses = JSON.parse(localStorage.getItem('taskStatuses') || '{}')
      taskStatuses[taskId] = 'in_progress'
      localStorage.setItem('taskStatuses', JSON.stringify(taskStatuses))
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
        console.warn('Error fetching X connection:', xConnectionError)
      }

      // Use provided xUsername, or get from connection, or default to 'unknown'
      const xUsernameToUse = xUsername || 
                            xConnection?.platform_username || 
                            'unknown'
                            
      console.log('X username for task completion:', xUsernameToUse)

      // Use the process_x_task_completion function
      const { data: result, error: processError } = await supabase.rpc('process_x_task_completion', {
        user_id_param: userId,
        task_title_param: task.title,
        x_username_param: xUsernameToUse
      })

      if (processError) {
        console.error('Error processing X task completion:', processError)
        
        // Fallback to direct insertion if RPC fails
        try {
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
            return { success: false, message: 'Could not verify task. Please try again.' }
          }

          // Award points manually
          try {
            const { error: pointsError } = await supabase.rpc('increment_user_points', {
              user_id_param: userId,
              points_to_add: task.points
            })

            if (pointsError) {
              console.error('Failed to award points:', pointsError)
            }
          } catch (pointsError) {
            console.error('Error calling increment_user_points:', pointsError)
          }
        } catch (fallbackError) {
          console.error('Error in fallback task completion:', fallbackError)
          setBountyTasks(prev => ({
            ...prev,
            active: prev.active.map(task =>
              task.id === taskId ? { ...task, status: 'in_progress' } : task
            )
          }))
          return { success: false, message: 'Could not verify task. Please try again.' }
        }
      }

      // 3. Mark as completed in UI
      setBountyTasks(prev => ({
        active: prev.active.filter(t => t.id !== taskId),
        completed: [...prev.completed, { ...task, status: 'completed' }]
      }))

      // Remove from in-progress tasks in localStorage
      const taskStatuses = JSON.parse(localStorage.getItem('taskStatuses') || '{}')
      delete taskStatuses[taskId]
      localStorage.setItem('taskStatuses', JSON.stringify(taskStatuses))

      await loadUserStats()
      return { 
        success: true, 
        message: `Task completed! You earned ${task.points} points.`,
        points: task.points
      }
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