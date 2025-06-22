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
        
        // Handle Twitter authentication via Supabase
        if (session.user.app_metadata.provider === 'twitter' && user) {
          console.log('Processing Twitter connection for user:', user.id)
          
          try {
            // Extract user info from Twitter session
            const platformUserId = session.user.user_metadata.provider_id || 
                                 session.user.user_metadata.sub || 
                                 session.user.id
            const platformUsername = session.user.user_metadata.user_name || 
                                   session.user.user_metadata.screen_name ||
                                   session.user.user_metadata.preferred_username ||
                                   session.user.user_metadata.name ||
                                   `user_${platformUserId}`
            
            // Create X social connection
            await addConnection({
              user_id: user.id,
              platform: 'x',
              platform_user_id: platformUserId,
              platform_username: platformUsername,
              is_active: true,
              auth_provider: 'supabase',
              kinde_connection_id: session.user.id,
              provider_metadata: session.user.user_metadata
            })
            
            // Update user record with Twitter connection info
            const { error: updateError } = await supabase
              .from('users')
              .update({
                x_connected_at: new Date().toISOString()
              })
              .eq('id', user.id)
            
            if (updateError) {
              console.error('Error updating user with Twitter info:', updateError)
            } else {
              console.log('Successfully updated user with X connection')
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