import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { supabase, User, processReferralFromCode, trackReferralClick } from '../lib/supabase'
import { generateUsername } from '../utils/username'
import { useReferralInfo } from './useReferralInfo'
import { ethers } from 'ethers'

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const useUser = () => {
  const { address, isConnected } = useAccount()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const { referralCode, clearReferralInfo } = useReferralInfo()

  useEffect(() => {
    if (isConnected && address) {
      handleWalletConnection()
    } else {
      // Clear user state when wallet disconnects
      setUser(null)
      setLoading(false)
      setError(null)
      setShowReferralModal(false)
      setIsNewUser(false)
    }
  }, [isConnected, address])

  const handleWalletConnection = async () => {
    if (!address) return

    console.log('🔄 Starting wallet connection for address:', address)
    setLoading(true)
    setError(null)

    try {
      const normalizedAddress = address.toLowerCase()
      console.log('📝 Normalized address:', normalizedAddress)

      // 1. Sign a message and get a Supabase JWT from backend
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const message = 'Sign this message to log in to Pumped!'
        const signature = await signer.signMessage(message)
        // Call your backend
        const response = await fetch('https://your-backend.onrender.com/auth/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: normalizedAddress, signature, message }),
        })
        const { token } = await response.json()
        // Set Supabase session
        await supabase.auth.setSession({ access_token: token, refresh_token: token })
      } else {
        throw new Error('No Ethereum provider found')
      }

      // 2. Try to get existing user
      console.log('🔍 Checking for existing user...')
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .maybeSingle()

      if (fetchError) {
        console.error('❌ Error fetching user:', fetchError)
        throw fetchError
      }

      let finalUser: User
      let userIsNew = false

      if (existingUser) {
        console.log('✅ Existing user found:', existingUser)
        finalUser = existingUser
        userIsNew = false
      } else {
        // Create new user using upsert to handle race conditions
        console.log('🆕 Creating new user for address:', normalizedAddress)
        const username = generateUsername()
        console.log('🎯 Generated username:', username)
        const newUserData: Omit<User, 'id' | 'referral_code'> = {
          wallet_address: normalizedAddress,
          username,
          connection_timestamp: new Date().toISOString(),
          current_points: 0,
          current_rank: 0
        }
        console.log('📊 New user data being sent to Supabase:', newUserData)
        // Use upsert to handle potential race conditions
        const { data: upsertedUser, error: upsertError } = await supabase
          .from('users')
          .upsert([newUserData], { 
            onConflict: 'wallet_address',
            ignoreDuplicates: false 
          })
          .select()
          .single()
        if (upsertError) {
          console.error('❌ Error upserting user:', upsertError)
          // If upsert fails, try to fetch the existing user one more time
          // This handles the case where another process created the user between our check and upsert
          console.log('🔄 Retrying to fetch user after upsert failure...')
          const { data: retryUser, error: retryError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', normalizedAddress)
            .single()
          if (retryError) {
            console.error('❌ Error fetching user after upsert failure:', retryError)
            throw upsertError // Throw the original upsert error
          }
          console.log('✅ Found existing user after upsert failure:', retryUser)
          finalUser = retryUser
          userIsNew = false
        } else {
          console.log('✅ New user created successfully:', upsertedUser)
          finalUser = upsertedUser
          userIsNew = true
        }
      }

      // Set user state immediately to prevent UI flickering
      console.log('🎯 Setting user state:', finalUser)
      setUser(finalUser)
      setIsNewUser(userIsNew)
      setLoading(false) // Set loading to false immediately after setting user
      
      // Process any pending referral in the background (non-blocking)
      if (userIsNew || !finalUser.current_points) {
        console.log('🔄 Processing pending referral in background...')
        // Use setTimeout to make this truly async and non-blocking
        setTimeout(() => {
          processReferralIfPending(finalUser.id)
        }, 100)
      }
      
      // Only show referral modal for new users who don't have a pending referral and haven't used a code
      if (userIsNew) {
        console.log('🆕 New user - checking for referral modal...')
        // Check for existing referral in background
        setTimeout(async () => {
          const hasExistingReferral = await checkExistingReferral(finalUser.id)
          const pendingReferral = referralCode
          
          console.log('📊 Referral check results:', { hasExistingReferral, pendingReferral })
          
          if (!pendingReferral && !hasExistingReferral) {
            console.log('🎯 Showing referral modal for new user')
            // Delay showing modal slightly to ensure smooth transition
            setTimeout(() => {
              setShowReferralModal(true)
            }, 1000) // Increased delay for smoother UX
          }
        }, 200)
      }

    } catch (err) {
      console.error('❌ Top-level error in handleWalletConnection:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect user')
      setLoading(false)
    }
  }

  const checkExistingReferral = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error checking existing referral:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking existing referral:', error)
      return false
    }
  }

  const processReferralIfPending = async (userId: string) => {
    const pendingReferral = referralCode
    if (pendingReferral) {
      try {
        console.log('Processing pending referral:', pendingReferral)
        
        // Track the referral click conversion
        const userAgent = navigator.userAgent
        await trackReferralClick(
          pendingReferral,
          undefined, // IP address will be handled server-side
          userAgent
        )
        
        // Process the referral using the new function
        const { data, error } = await supabase.rpc('process_referral_code_entry', {
          referral_code_param: pendingReferral,
          referee_id_param: userId
        })
        
        if (error) {
          console.warn('Referral processing failed:', error)
        } else if (data?.success) {
          console.log('Referral processed successfully:', data)
          // Refresh user data to show updated points
          await refreshUser()
        } else {
          console.warn('Referral processing failed:', data?.error)
        }
        
        // Clear the pending referral regardless of success/failure
        clearReferralInfo()
        
      } catch (refError) {
        console.warn('Failed to process referral:', refError)
        // Clear the pending referral even if processing fails
        clearReferralInfo()
      }
    }
  }

  // Force refresh user data
  const refreshUser = async () => {
    if (!address) return
    
    try {
      const { data: updatedUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', address.toLowerCase())
        .single()
      
      if (updatedUser) {
        setUser(updatedUser)
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }

  const handleReferralModalClose = () => {
    setShowReferralModal(false)
  }

  const handleReferralSuccess = () => {
    // Refresh user data to get updated points
    refreshUser()
    setShowReferralModal(false)
  }

  return {
    user,
    loading,
    error,
    isConnected: isConnected && !!user,
    isNewUser,
    refreshUser,
    showReferralModal: showReferralModal && isNewUser, // Only show for new users
    handleReferralModalClose,
    handleReferralSuccess
  }
}