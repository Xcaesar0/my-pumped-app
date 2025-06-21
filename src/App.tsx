import React, { useEffect } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import { useReferralPersistence } from './hooks/useReferralPersistence'
import { useSocialConnections } from './hooks/useSocialConnections'
import { useUser } from './hooks/useUser'
import Header from './components/Header';
import Hero from './components/Hero';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReferralPageWrapper from './components/ReferralPageWrapper';
import { supabase } from './lib/supabase'

// Get projectId from environment variables
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

// Only create Web3Modal if we have a valid project ID
const hasValidProjectId = projectId && projectId !== 'your_project_id_here' && projectId.length > 0

if (hasValidProjectId) {
  try {
    createWeb3Modal({
      wagmiConfig: config,
      projectId: projectId,
      enableAnalytics: true,
      enableOnramp: true
    })
  } catch (error) {
    console.error('Failed to create Web3Modal:', error)
  }
} else {
  console.warn('WalletConnect Project ID is not configured. Wallet connection features will be disabled. Please visit https://cloud.walletconnect.com to get your Project ID and update your .env file.')
}

// Create a client
const queryClient = new QueryClient()

function AppContent() {
  const { user } = useUser()
  const { addConnection, loadConnections } = useSocialConnections(user?.id || null)

  // Initialize referral persistence on app load
  useReferralPersistence()
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        if(user && session.provider_token) {
          // This likely means a new OAuth connection has been made
          await addConnection({
            platform: session.user.app_metadata.provider as 'telegram' | 'x',
            platform_user_id: session.user.id,
            platform_username: session.user.user_metadata.user_name,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
          })
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