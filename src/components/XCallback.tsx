import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'

export default function XCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const { loadConnections } = useSocialConnections(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the OAuth callback
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        
        if (!accessToken) {
          throw new Error('No access token received')
        }

        // Set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        })

        if (sessionError) {
          throw sessionError
        }

        // Get session to verify Twitter connection
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession()
        
        if (getSessionError) {
          throw getSessionError
        }

        if (!session?.user?.identities?.some(id => id.provider === 'twitter')) {
          setError('Twitter connection not found. Please try again.')
          setStatus('error')
          return
        }

        // Refresh the connections list
        await loadConnections()
        
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
  }, [navigate, loadConnections])

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