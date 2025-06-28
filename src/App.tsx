import React, { useEffect } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import { useUser } from './hooks/useUser'
import Header from './components/Header';
import Hero from './components/Hero';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReferralPageWrapper from './components/ReferralPageWrapper';
import XCallback from './components/XCallback';

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
  console.warn(`
    ⚠️  WalletConnect Project ID Configuration Required
    
    To fix wallet connection issues:
    1. Visit https://cloud.walletconnect.com
    2. Create a new project or use an existing one
    3. Copy your Project ID
    4. Update your .env file:
       VITE_WALLETCONNECT_PROJECT_ID=your_actual_project_id
    5. Restart your development server
    
    Current status: Using fallback configuration (limited functionality)
  `)
}

// Create a client
const queryClient = new QueryClient()

function AppContent() {
  const { user } = useUser()

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: '#1A1A1A' }}>
      <Header />
      <Hero />
    </div>
  )
}

function App() {
  // Initialize localStorage for task persistence if not already set
  useEffect(() => {
    if (!localStorage.getItem('completedTasks')) {
      localStorage.setItem('completedTasks', JSON.stringify([]))
    }
    if (!localStorage.getItem('taskStatuses')) {
      localStorage.setItem('taskStatuses', JSON.stringify({}))
    }
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/ref/:referralCode" element={<ReferralPageWrapper />} />
            <Route path="/callback" element={<XCallback />} />
            <Route path="*" element={<AppContent />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;