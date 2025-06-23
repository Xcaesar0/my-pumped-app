import { useState, useEffect, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { supabase, SocialConnection, processReferralFromCode, trackReferralClick } from '../lib/supabase'
import { generateUsername } from '../utils/username'
import { useReferralInfo } from './useReferralInfo'
import { useAuth0 } from '@auth0/auth0-react'

export type User = {
  id: string;
  wallet_address: string;
  username: string;
  referral_code: string;
  points: number;
  social_connections: {
    [key: string]: any;
  } | null;
  created_at: string;
};

export const useUser = () => {
  const { address, isConnected } = useAccount()
  const [user, setUser] = useState<User | null>(null)
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const { disconnect } = useDisconnect()
  const [error, setError] = useState<string | null>(null)
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false)
  const [isNewUser, setIsNewUser] = useState<boolean>(false)
  const { referralCode, clearReferralInfo } = useReferralInfo()
  const {
    loginWithRedirect: auth0Login, 
    logout: auth0Logout, 
    user: auth0User, 
    isAuthenticated: isAuth0Authenticated,
    getAccessTokenSilently
  } = useAuth0()

  const fetchUser = useCallback(async () => {
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
        // Create new user
        const username = generateUsername();
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ 
            wallet_address: address, 
            username,
            current_points: 0,
            current_rank: 0,
            connection_timestamp: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;

        setUser(newUser);
        setIsNewUser(true);
        setShowReferralModal(true);
        setConnections([]);
      }

    } catch (error: any) {
      console.error('Error refreshing user:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [address])

  const refreshSocialConnections = async () => {
    await fetchUser();
  };

  useEffect(() => {
    if (isConnected) {
      fetchUser()
    } else {
      setUser(null)
      setConnections([])
      setError(null)
      setIsNewUser(false)
    }
  }, [address, isConnected, fetchUser])

  const handleReferralModalClose = () => {
    setShowReferralModal(false)
  }

  const handleReferralSuccess = () => {
    fetchUser()
  }

  return { 
    user, 
    connections,
    loading, 
    error, 
    isConnected, 
    isNewUser, 
    fetchUser,
    refreshSocialConnections,
    showReferralModal,
    handleReferralModalClose,
    handleReferralSuccess
  }
}