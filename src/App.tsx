import React, { useEffect } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import { useSocialConnections } from './hooks/useSocialConnections'
import { useUser } from './hooks/useUser'
import Header from './components/Header';
import Hero from './components/Hero';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReferralPageWrapper from './components/ReferralPageWrapper';
import { supabase } from './lib/supabase'
import { createSocialConnectionFromTwitter } from './services/socialAuth'

// Get projectId from environment variables
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

// Always create Web3Modal, using a fallback project ID if needed
const effectiveProjectId = projectId && projectId !== 'your_project_id_here' && projectId.length > 0 
  ? projectId 
  : 'fallback-project-id'

try {
  createWeb3Modal({
    wagmiConfig: config,
    projectId: effectiveProjectId,
    enableAnalytics: true,
    enableOnramp: true
  })
} catch (error) {
  console.error('Failed to create Web3Modal:', error)
}

if (!projectId || projectId === 'your_project_id_here') {
  console.warn('WalletConnect Project ID is not configured. Wallet connection features may be limited. Please visit https://cloud.walletconnect.com to get your Project ID and update your .env file.')
}

// Create a client
const queryClient = new QueryClient()

function AppContent() {
  const { user } = useUser()
  const { addConnection, loadConnections } = useSocialConnections(user?.id || null)
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        console.log('Auth state change:', event, session)
        
        // Handle Twitter authentication
        if (session.user.app_metadata.provider === 'twitter' && user) {
          console.log('Processing Twitter connection for user:', user.id)
          
          try {
            // Extract user info from Twitter session
            const twitterUser = session.user.user_metadata
            const platformUserId = twitterUser.provider_id || twitterUser.sub || session.user.id
            const platformUsername = twitterUser.user_name || 
                                   twitterUser.preferred_username || 
                                   twitterUser.name || 
                                   `user_${platformUserId}`
            
            // Create X social connection using the helper function
            const connectionData = createSocialConnectionFromTwitter(user.id, {
              id: platformUserId,
              user_name: platformUsername,
              name: twitterUser.name,
              ...twitterUser
            })

            await addConnection(connectionData)
            
            // Update user record with Twitter connection timestamp
            const { error: updateError } = await supabase
              .from('users')
              .update({
                x_connected_at: new Date().toISOString()
              })
              .eq('id', user.id)
            
            if (updateError) {
              console.error('Error updating user with Twitter info:', updateError)
            } else {
              console.log('Successfully updated user with Twitter connection')
            }
            
          } catch (error) {
            console.error('Error processing Twitter connection:', error)
          }
        }
        
        // Always reload connections on auth change
        loadConnections()
      }
    })
    
    return () => {
      subscription.unsubscribe()
    }
  }, [user, addConnection, loadConnections])

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: '#1A1A1A' }}>
      <Header />
      <Hero />
    </div>
  )
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/ref/:referralCode" element={<ReferralPageWrapper />} />
            <Route path="*" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;