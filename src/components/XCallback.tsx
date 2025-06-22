import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'

export default function XCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const { user } = useUser()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if user is authenticated
        if (!user?.id) {
          setError('User not authenticated. Please connect your wallet first.')
          setStatus('error')
          return
        }

        const urlParams = new URLSearchParams(window.location.search)
        const oauthToken = urlParams.get('oauth_token')
        const oauthVerifier = urlParams.get('oauth_verifier')
        const denied = urlParams.get('denied')

        if (denied) {
          setError('Authorization was denied by the user')
          setStatus('error')
          return
        }

        if (!oauthToken || !oauthVerifier) {
          setError('Missing OAuth parameters')
          setStatus('error')
          return
        }

        // Call your Edge Function to exchange the tokens
        const { data, error } = await supabase.functions.invoke('x-oauth', {
          body: {
            action: 'exchange_token',
            oauth_token: oauthToken,
            oauth_verifier: oauthVerifier
          }
        })

        if (error) {
          console.error('Edge function error:', error)
          throw new Error(error.message || 'Failed to exchange tokens')
        }

        if (data) {
          // Store the X connection in your database
          const { error: dbError } = await supabase
            .from('social_connections')
            .upsert({
              user_id: user.id,
              platform: 'x',
              platform_user_id: data.user_id,
              platform_username: data.screen_name,
              access_token: data.access_token,
              access_token_secret: data.access_token_secret,
              user_data: data.user_data,
              is_active: true
            })

          if (dbError) {
            console.error('Database error:', dbError)
            throw new Error(dbError.message)
          }

          setStatus('success')
          // Redirect back to the main app after a short delay
          setTimeout(() => {
            navigate('/')
          }, 2000)
        } else {
          throw new Error('No data received from OAuth exchange')
        }
      } catch (err) {
        console.error('X callback error:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStatus('error')
      }
    }

    handleCallback()
  }, [navigate, user])

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