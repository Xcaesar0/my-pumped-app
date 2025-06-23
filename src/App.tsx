import React from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import { useUser } from './hooks/useUser'
import Header from './components/Header';
import Hero from './components/Hero';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReferralPageWrapper from './components/ReferralPageWrapper';
import Auth0Linker from './components/Auth0Linker';

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

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: '#1A1A1A' }}>
      <Auth0Linker />
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
            <Route path="/" element={<AppContent />} />
            <Route path="/referral/:referralCode" element={<ReferralPageWrapper />} />
            <Route path="/callback" element={<Auth0Linker />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;