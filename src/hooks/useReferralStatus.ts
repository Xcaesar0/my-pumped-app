import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ReferralStatus {
  hasUsedReferral: boolean
  referrerUsername?: string
  status?: 'pending' | 'active' | 'completed'
  referralId?: string
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
        .from('referrals')
        .select(`
          id,
          status,
          referrer:users!referrer_id(username)
        `)
        .eq('referred_id', userId)
        .maybeSingle()

      if (referralError) {
        console.error('Error loading referral status:', referralError)
        throw referralError
      }

      if (referralData) {
        setReferralStatus({
          hasUsedReferral: true,
          referrerUsername: (referralData.referrer as any)?.username || 'Unknown',
          status: referralData.status,
          referralId: referralData.id
        })
      } else {
        setReferralStatus({
          hasUsedReferral: false
        })
      }
    } catch (err) {
      console.error('Error loading referral status:', err)
      setError(err instanceof Error ? err.message : 'Failed to load referral status')
      setReferralStatus({
        hasUsedReferral: false
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