import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useAccount } from 'wagmi'

export default function XCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const { user } = useUser()
  const { address } = useAccount()
  const { loadConnections } = useSocialConnections(user?.id || null)

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

        // Always use the authenticated user's id for social_connections
        const userIdToUse = session.user.id;
        
        // Try to find existing user by wallet address first
        let existingUser = null;
        if (address) {
          const { data: userByWallet, error: walletError } = await supabase
            .from('users')
            .select('*')
            .eq('wallet_address', address.toLowerCase())
            .maybeSingle();
          
          if (walletError) {
            console.error('Error finding user by wallet:', walletError);
          } else if (userByWallet) {
            existingUser = userByWallet;
          }
        }

        // If no user found by wallet, try by user ID
        if (!existingUser) {
          const { data: userById, error: idError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userIdToUse)
            .maybeSingle();
          
          if (idError) {
            console.error('Error finding user by ID:', idError);
            setError('Failed to find user: ' + idError.message);
            setStatus('error');
            return;
          }
          
          existingUser = userById;
        }

        // If still no user found, create a new one
        if (!existingUser) {
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              id: userIdToUse,
              username: session.user.email || twitterIdentity.identity_data?.username || 'XUser',
              is_active: true,
              wallet_address: address?.toLowerCase() || userIdToUse,
              current_points: 0,
              current_rank: 0
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user:', insertError);
            setError('Failed to create user: ' + insertError.message);
            setStatus('error');
            return;
          }

          existingUser = newUser;
        }

        // Upsert into social_connections table using userIdToUse
        const twitterUsername = twitterIdentity.identity_data?.screen_name || twitterIdentity.identity_data?.username || ''
        const { error: dbError, data: upsertData } = await supabase
          .from('social_connections')
          .upsert({
            user_id: userIdToUse,
            platform: 'x',
            platform_user_id: twitterIdentity.id,
            platform_username: twitterUsername,
            user_data: twitterIdentity,
            is_active: true
          }, { 
            onConflict: 'user_id,platform',
            ignoreDuplicates: false
          })
          .select()

        console.log('Upsert response:', { error: dbError, data: upsertData });
        
        if (dbError) {
          console.error('Failed to save connection:', dbError);
          setError('Failed to save connection: ' + dbError.message)
          setStatus('error')
          return
        }

        // Refresh the connections list
        await loadConnections()
        
        setStatus('success')
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred')
        setStatus('error')
      }
    }
    handleCallback()
  }, [navigate, loadConnections, address])

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