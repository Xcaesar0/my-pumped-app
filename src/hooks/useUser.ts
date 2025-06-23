import { useState, useEffect, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { supabase, User, SocialConnection, processReferralFromCode, trackReferralClick } from '../lib/supabase'
import { generateUsername } from '../utils/username'
import { useReferralInfo } from './useReferralInfo'

export const useUser = () => {
  const { address, isConnected } = useAccount()
  const [user, setUser] = useState<User | null>(null)
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false)
  const [isNewUser, setIsNewUser] = useState<boolean>(false)
  const { referralCode, clearReferralInfo } = useReferralInfo()

  const refreshUser = useCallback(async () => {
    if (!address) {
      setUser(null)
      setConnections([])
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', address)
        .single()

      if (userError && userError.code !== 'PGRST116') {
        throw userError
      }
      
      if (userData) {
        setUser(userData)
        setIsNewUser(false)
        
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', userData.id)
          .eq('is_active', true)
          
        if (connectionsError) throw connectionsError;
        
        setConnections(connectionsData || [])
      } else {
        setIsNewUser(true)
        setShowReferralModal(true)
        setUser(null)
        setConnections([])
      }

    } catch (error: any) {
      console.error('Error refreshing user:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [address])

  const refreshSocialConnections = async () => {
    await refreshUser();
  };

  useEffect(() => {
    if (isConnected) {
      refreshUser()
    } else {
      setUser(null)
      setConnections([])
      setError(null)
      setIsNewUser(false)
    }
  }, [address, isConnected, refreshUser])

  const handleReferralModalClose = () => {
    setShowReferralModal(false)
  }

  const handleReferralSuccess = () => {
    refreshUser()
  }

  return { 
    user, 
    connections,
    loading, 
    error, 
    isConnected, 
    isNewUser, 
    refreshUser,
    refreshSocialConnections,
    showReferralModal,
    handleReferralModalClose,
    handleReferralSuccess
  }
}