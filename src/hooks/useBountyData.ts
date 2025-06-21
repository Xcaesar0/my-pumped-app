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

export interface LeaderboardData {
  referrers: Array<{
    username: string
    referrals: number
    rank: number
  }>
  points: Array<{
    username: string
    points: number
    rank: number
  }>
}

export const useBountyData = (userId: string) => {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>({ referrers: [], points: [] })
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
        loadLeaderboard()
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
      // Get top points holders
      const pointsData = await getLeaderboard(50)

      // Get top referrers
      const referrersData = await getReferralLeaderboard(50)

      setLeaderboard({
        referrers: referrersData.map(entry => ({
          username: entry.username,
          referrals: entry.referrals || 0,
          rank: entry.rank
        })),
        points: pointsData
      })
    } catch (error) {
      console.error('Error loading leaderboard:', error)
      throw error
    }
  }

  const refreshData = async () => {
    await loadAllData()
  }

  return {
    userStats,
    leaderboard,
    loading,
    error,
    refreshData
  }
}