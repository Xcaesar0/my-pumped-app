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
        // Wait for Supabase to update the session after OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          setError('Failed to get session: ' + sessionError.message)
          setStatus('error')
          return
        }
        if (!session || !session.user) {
          setError('No active session. Please try connecting again.')
          setStatus('error')
          return
        }
        // Check if Twitter is linked in user identities
        const identities = session.user.identities || []
        const twitterIdentity = identities.find((id: any) => id.provider === 'twitter')
        if (!twitterIdentity) {
          setError('Twitter account not linked. Please try again.')
          setStatus('error')
          return
        }
        // Ensure user exists in custom users table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .single()
        if (!existingUser) {
          // Insert user into your custom users table with default values for required fields
          const { error: insertUserError } = await supabase.from('users').insert({
            id: session.user.id,
            username: session.user.email || 'XUser', // or another default
            is_active: true,
            points: 0,
            wallet_address: '', // Always provide a value for wallet_address
            // add other required fields with defaults if needed
          })
          if (insertUserError) {
            setError('Failed to create user: ' + insertUserError.message)
            setStatus('error')
            return
          }
        }
        // Upsert into social_connections table
        const twitterUsername = twitterIdentity.identity_data?.screen_name || twitterIdentity.identity_data?.username || ''
        const { error: dbError } = await supabase
          .from('social_connections')
          .upsert({
            user_id: session.user.id,
            platform: 'x',
            platform_user_id: twitterIdentity.id,
            platform_username: twitterUsername,
            user_data: twitterIdentity,
            is_active: true
          })
        if (dbError) {
          setError('Failed to save connection: ' + dbError.message)
          setStatus('error')
          return
        }
        setStatus('success')
        setTimeout(() => {
          navigate('/')
        }, 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStatus('error')
      }
    }
    handleCallback()
  }, [navigate])

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