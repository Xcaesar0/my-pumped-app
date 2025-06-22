import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ReferralStatus {
  hasUsedReferral: boolean
  referrerUsername?: string
  status?: 'pending' | 'active' | 'completed'
  referralId?: string
  pointsEarned?: number
  socialConnectionsCount?: number
}

export const useReferralStatus = (userId: string | null) => {
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      loadReferralStatus()
    } else {
      setReferralStatus(null)
      setLoading(false)
    }
  }, [userId])

  const loadReferralStatus = async () => {
    if (!userId || userId === 'undefined') {
      setReferralStatus(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if user has used a referral code (is a referee)
      const { data: referralData, error: referralError } = await supabase
        .from('referral_tracking')
        .select(`
          id,
          referrer:users!referrer_id(username),
          code_entry_points_awarded,
          first_social_points_awarded,
          second_social_points_awarded,
          chain_continuation_points_awarded,
          twitter_connected,
          telegram_connected
        `)
        .eq('referee_id', userId)
        .maybeSingle()

      if (referralError) {
        console.error('Error loading referral status:', referralError)
        throw referralError
      }

      // Count social connections
      const { count: socialCount } = await supabase
        .from('social_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)

      // Calculate points earned from referral system
      const { data: pointAwards } = await supabase
        .from('point_awards')
        .select('points_awarded')
        .eq('user_id', userId)
        .in('award_type', [
          'referral_code_entry_referee',
          'twitter_connection_referee',
          'telegram_connection_referee',
          'self_referral_referee'
        ])

      const totalPointsEarned = pointAwards?.reduce((sum, award) => sum + award.points_awarded, 0) || 0

      if (referralData) {
        setReferralStatus({
          hasUsedReferral: true,
          referrerUsername: (referralData.referrer as any)?.username || 'Unknown',
          status: 'active',
          referralId: referralData.id,
          pointsEarned: totalPointsEarned,
          socialConnectionsCount: socialCount || 0
        })
      } else {
        setReferralStatus({
          hasUsedReferral: false,
          pointsEarned: totalPointsEarned,
          socialConnectionsCount: socialCount || 0
        })
      }
    } catch (err) {
      console.error('Error loading referral status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load referral status')
      setReferralStatus({
        hasUsedReferral: false,
        pointsEarned: 0,
        socialConnectionsCount: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshReferralStatus = async () => {
    await loadReferralStatus()
  }

  return {
    referralStatus,
    loading,
    error,
    refreshReferralStatus
  }
}