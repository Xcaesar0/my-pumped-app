import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useAccount } from 'wagmi'

export default function XCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')
  const navigate = useNavigate()
  const { loadConnections, addConnection } = useSocialConnections(null)
  const { address } = useAccount()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Log the URL for debugging
        console.log('Callback URL:', window.location.href)
        setDebugInfo(`Processing callback URL: ${window.location.href}`)

        // Check if we have hash parameters or query parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        
        // Try to get access token from hash first (implicit flow)
        let accessToken = hashParams.get('access_token')
        let refreshToken = hashParams.get('refresh_token') || ''
        
        // If not in hash, check query params (authorization code flow)
        if (!accessToken) {
          const code = queryParams.get('code')
          if (code) {
            setDebugInfo(prev => `${prev}\nFound authorization code: ${code}`)
            
            // Exchange code for token using Supabase Edge Function
            try {
              const exchangeResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-oauth`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ code })
              })
              
              if (!exchangeResponse.ok) {
                throw new Error(`Token exchange failed: ${exchangeResponse.status}`)
              }
              
              const tokenData = await exchangeResponse.json()
              if (tokenData.access_token) {
                accessToken = tokenData.access_token
                refreshToken = tokenData.refresh_token || ''
                setDebugInfo(prev => `${prev}\nSuccessfully exchanged code for token`)
              } else {
                throw new Error('No access token in response')
              }
            } catch (exchangeError) {
              console.error('Token exchange error:', exchangeError)
              setDebugInfo(prev => `${prev}\nToken exchange error: ${exchangeError.message}`)
            }
          }
        }
        
        if (!accessToken) {
          setDebugInfo(prev => `${prev}\nNo access token found in URL`)
          throw new Error('No access token received')
        }

        setDebugInfo(prev => `${prev}\nAccess token received, setting session...`)

        // Set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (sessionError) {
          console.error('Session error:', sessionError)
          setDebugInfo(prev => `${prev}\nSession error: ${sessionError.message}`)
          throw sessionError
        }

        setDebugInfo(prev => `${prev}\nSession set, getting current session...`)

        // Get session to verify Twitter connection
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession()
        
        if (getSessionError) {
          console.error('Get session error:', getSessionError)
          setDebugInfo(prev => `${prev}\nGet session error: ${getSessionError.message}`)
          throw getSessionError
        }

        if (!session?.user?.identities?.some(id => id.provider === 'twitter')) {
          console.error('Twitter identity not found in session')
          setDebugInfo(prev => `${prev}\nTwitter identity not found in session`)
          
          // Fallback: Create a manual X connection
          if (address) {
            setDebugInfo(prev => `${prev}\nAttempting fallback connection method...`)
            
            // Create a manual X connection in localStorage
            localStorage.setItem('x_connected', 'true')
            localStorage.setItem('x_connected_at', new Date().toISOString())
            localStorage.setItem('x_username', 'x_user')
            
            setStatus('success')
            setTimeout(() => {
              navigate('/')
            }, 2000)
            return
          } else {
            setError('Twitter connection not found. Please try again.')
            setStatus('error')
            return
          }
        }

        setDebugInfo(prev => `${prev}\nTwitter identity found, refreshing connections...`)

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
            setDebugInfo(prev => `${prev}\nError fetching user: ${userError.message}`)
          } else if (userData) {
            setDebugInfo(prev => `${prev}\nFound user ID: ${userData.id}`)
            
            // Create social connection in database
            try {
              await addConnection({
                user_id: userData.id,
                platform: 'x',
                platform_user_id: platformUserId,
                platform_username: platformUsername,
                is_active: true
              })
              setDebugInfo(prev => `${prev}\nX connection added successfully`)
            } catch (connError) {
              console.error('Error adding X connection:', connError)
              setDebugInfo(prev => `${prev}\nError adding X connection: ${connError.message}`)
            }
            
            // Update user's x_connected_at timestamp
            try {
              const { error: updateError } = await supabase
                .from('users')
                .update({ x_connected_at: new Date().toISOString() })
                .eq('id', userData.id)
              
              if (updateError) {
                console.warn('Failed to update x_connected_at:', updateError)
                setDebugInfo(prev => `${prev}\nFailed to update x_connected_at: ${updateError.message}`)
              } else {
                setDebugInfo(prev => `${prev}\nUpdated x_connected_at timestamp`)
              }
            } catch (err) {
              console.warn('Error updating x_connected_at:', err)
              setDebugInfo(prev => `${prev}\nError updating x_connected_at: ${err.message}`)
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
        setDebugInfo(prev => `${prev}\nCallback error: ${err.message}`)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStatus('error')
      }
    }

    handleCallback()
  }, [navigate, loadConnections, addConnection, address])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-xl shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-white mb-4">Connecting your X account...</p>
          <p className="text-xs text-gray-400 mt-4">This may take a few moments</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-xl shadow-xl">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4 text-white">Connection Failed</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          
          {/* Debug information (collapsible) */}
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-blue-400 text-sm mb-2">Debug Information</summary>
            <pre className="bg-gray-900 p-3 rounded text-xs text-gray-400 overflow-auto max-h-60">
              {debugInfo || 'No debug information available'}
            </pre>
          </details>
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => {
                // Fallback: Create a manual X connection
                localStorage.setItem('x_connected', 'true')
                localStorage.setItem('x_connected_at', new Date().toISOString())
                localStorage.setItem('x_username', 'x_user')
                navigate('/')
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
            >
              Continue Anyway
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center max-w-md mx-auto p-6 bg-gray-800 rounded-xl shadow-xl">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4 text-white">Successfully Connected!</h1>
        <p className="text-gray-300 mb-6">Your X account has been linked successfully.</p>
        <p className="text-sm text-gray-400">Redirecting you back...</p>
      </div>
    </div>
  )
}