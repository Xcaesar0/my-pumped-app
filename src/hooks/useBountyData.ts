import { useState, useEffect } from 'react'
import { supabase, User, getLeaderboard, getReferralLeaderboard } from '../lib/supabase'

export interface UserStats {
  totalReferrals: number
  bonusReferrals: number
  totalPoints: number
  bonusPoints: number
  globalRank: number
  referredBy?: string
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

export const useBountyData = (userId: string) => {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [bountyTasks, setBountyTasks] = useState<BountyTasksData>({ active: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadAllData()
    }
  }, [userId])

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
    if (!userId || userId === 'undefined') {
      console.warn('Invalid userId provided to loadUserStats')
      return
    }

    try {
      // Get user's current data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('current_points, current_rank')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get referral count
      const { count: referralCount } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId)
        .eq('status', 'active')

      // Get referrer info
      const { data: referralData } = await supabase
        .from('referrals')
        .select('referrer:users!referrer_id(username)')
        .eq('referred_id', userId)
        .maybeSingle()

      // Calculate global rank
      const { count: higherRankedCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('current_points', user.current_points)

      const globalRank = (higherRankedCount || 0) + 1

      setUserStats({
        totalReferrals: referralCount || 0,
        bonusReferrals: 0, // TODO: Implement bonus referrals logic
        totalPoints: user.current_points || 0,
        bonusPoints: 0, // TODO: Implement bonus points logic
        globalRank,
        referredBy: referralData?.referrer?.username
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
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', user.id)
            .eq('status', 'active')

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
    if (!userId || userId === 'undefined') {
      console.warn('Invalid userId provided to loadBountyTasks')
      return
    }

    try {
      // Check user's social connections
      const { data: socialConnections } = await supabase
        .from('social_connections')
        .select('platform')
        .eq('user_id', userId)
        .eq('is_active', true)

      const connectedPlatforms = socialConnections?.map(conn => conn.platform) || []

      // Get completed tasks from localStorage to persist across sessions
      const completedTasksKey = `completed_tasks_${userId}`
      const completedTaskIds = JSON.parse(localStorage.getItem(completedTasksKey) || '[]')

      // Define available tasks (X tasks now require connection)
      const allTasks: BountyTask[] = [
        {
          id: 'join_telegram',
          title: 'Join Telegram',
          description: 'Join our official Telegram community',
          platform: 'telegram',
          points: 50,
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
          points: 50,
          status: 'not_started',
          action_url: 'https://x.com/pumpeddotfun',
          verification_type: 'manual',
          requires_connection: true // X tasks now require connection
        },
        {
          id: 'repost_launch',
          title: 'Repost Launch Post',
          description: 'Repost our latest launch announcement',
          platform: 'x',
          points: 75,
          status: 'not_started',
          action_url: 'https://x.com/pumpeddotfun/status/123456789',
          verification_type: 'manual',
          requires_connection: true // X tasks now require connection
        }
      ]

      // Update task statuses based on user's connections and completion
      const updatedTasks = allTasks.map(task => {
        // Check if task is completed (from localStorage or social connections)
        if (completedTaskIds.includes(task.id)) {
          return { ...task, status: 'completed' as const }
        }
        
        // Check if user has required connection for auto-completion
        if (task.platform === 'telegram' && connectedPlatforms.includes('telegram')) {
          return { ...task, status: 'completed' as const }
        }
        
        if (task.platform === 'x' && connectedPlatforms.includes('x')) {
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

  const verifyTask = async (taskId: string) => {
    try {
      const task = bountyTasks.active.find(t => t.id === taskId)
      if (!task) return

      setBountyTasks(prev => ({
        ...prev,
        active: prev.active.map(task =>
          task.id === taskId ? { ...task, status: 'verifying' } : task
        )
      }))

      // For X tasks, automatically complete and award points
      if (task.platform === 'x') {
        // Award points using the increment function
        const { error: pointsError } = await supabase.rpc('increment_user_points', {
          user_id_param: userId,
          points_to_add: task.points
        })

        if (pointsError) {
          console.warn('Failed to award points:', pointsError)
        }

        // Move task to completed
        setBountyTasks(prev => ({
          active: prev.active.filter(t => t.id !== taskId),
          completed: [...prev.completed, { ...task, status: 'completed' }]
        }))

        // Save completed task to localStorage
        const completedTasksKey = `completed_tasks_${userId}`
        const completedTaskIds = JSON.parse(localStorage.getItem(completedTasksKey) || '[]')
        completedTaskIds.push(taskId)
        localStorage.setItem(completedTasksKey, JSON.stringify(completedTaskIds))

        // Refresh user stats to show updated points
        await loadUserStats()
        
        return { success: true, pointsAwarded: task.points }
      }

      // For other tasks, simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock verification - in production, this would check actual completion
      const isCompleted = Math.random() > 0.3 // 70% success rate for demo

      if (isCompleted) {
        setBountyTasks(prev => ({
          active: prev.active.filter(t => t.id !== taskId),
          completed: [...prev.completed, { ...task, status: 'completed' }]
        }))

        // Award points using the increment function
        const { error: pointsError } = await supabase.rpc('increment_user_points', {
          user_id_param: userId,
          points_to_add: task.points
        })

        if (pointsError) {
          console.warn('Failed to award points:', pointsError)
        }

        // Refresh user stats
        await loadUserStats()
      } else {
        setBountyTasks(prev => ({
          ...prev,
          active: prev.active.map(task =>
            task.id === taskId ? { ...task, status: 'in_progress' } : task
          )
        }))
      }
    } catch (error) {
      console.error('Error verifying task:', error)
      setBountyTasks(prev => ({
        ...prev,
        active: prev.active.map(task =>
          task.id === taskId ? { ...task, status: 'in_progress' } : task
        )
      }))
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
    verifyTask
  }
}