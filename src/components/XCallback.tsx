import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useAccount } from 'wagmi'

export default function XCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const { loadConnections, addConnection } = useSocialConnections(null)
  const { address } = useAccount()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the OAuth callback
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        
        if (!accessToken) {
          throw new Error('No access token received')
        }

        console.log('Access token received, setting session...')

        // Set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        })

        if (sessionError) {
          console.error('Session error:', sessionError)
          throw sessionError
        }

        console.log('Session set, getting current session...')

        // Get session to verify Twitter connection
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession()
        
        if (getSessionError) {
          console.error('Get session error:', getSessionError)
          throw getSessionError
        }

        if (!session?.user?.identities?.some(id => id.provider === 'twitter')) {
          console.error('Twitter identity not found in session')
          setError('Twitter connection not found. Please try again.')
          setStatus('error')
          return
        }

        console.log('Twitter identity found, refreshing connections...')

        // Get Twitter identity data
        const twitterIdentity = session.user.identities.find(id => id.provider === 'twitter')
        const platformUserId = twitterIdentity?.id || ''
        const platformUsername = twitterIdentity?.identity_data?.username || 'x_user'

        // Get user ID from wallet address
        if (address) {
          const normalizedAddress = address.toLowerCase()
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', normalizedAddress)
            .single()

          if (userError) {
            console.error('Error fetching user by wallet address:', userError)
          } else if (userData) {
            console.log('Found user ID:', userData.id)
            
            // Create social connection in database
            try {
              await addConnection({
                user_id: userData.id,
                platform: 'x',
                platform_user_id: platformUserId,
                platform_username: platformUsername,
                is_active: true
              })
              console.log('X connection added successfully')
            } catch (connError) {
              console.error('Error adding X connection:', connError)
            }
            
            // Update user's x_connected_at timestamp
            try {
              const { error: updateError } = await supabase
                .from('users')
                .update({ x_connected_at: new Date().toISOString() })
                .eq('id', userData.id)
              
              if (updateError) {
                console.warn('Failed to update x_connected_at:', updateError)
              } else {
                console.log('Updated x_connected_at timestamp')
              }
            } catch (err) {
              console.warn('Error updating x_connected_at:', err)
            }
          }
        }

        // Refresh the connections list
        await loadConnections()
        
        // Store X connection in localStorage for persistence
        localStorage.setItem('x_connected', 'true')
        localStorage.setItem('x_connected_at', new Date().toISOString())
        localStorage.setItem('x_username', platformUsername)
        
        setStatus('success')
        
        setTimeout(() => {
          navigate('/')
        }, 2000)
      } catch (err) {
        console.error('Callback error:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStatus('error')
      }
    }

    handleCallback()
  }, [navigate, loadConnections, addConnection, address])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Connecting your X account...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Connection Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4">Successfully Connected!</h1>
        <p className="text-gray-600 mb-6">Your X account has been linked successfully.</p>
        <p className="text-sm text-gray-500">Redirecting you back...</p>
      </div>
    </div>
  )
}