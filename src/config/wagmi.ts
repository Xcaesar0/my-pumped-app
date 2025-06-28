import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { mainnet, arbitrum, polygon } from 'wagmi/chains'

// Get projectId from environment variables
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

if (!projectId || projectId === 'your_project_id_here') {
  console.warn('WalletConnect Project ID is not configured. Please visit https://cloud.walletconnect.com to get your Project ID and update your .env file.')
}

// Create wagmiConfig
const metadata = {
  name: 'pumped.fun',
  description: 'Beyond The Pump',
  url: 'https://web3modal.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const chains = [mainnet, arbitrum, polygon] as const

// Use a fallback project ID if none is provided to prevent initialization errors
const effectiveProjectId = projectId && projectId !== 'your_project_id_here' && projectId.length > 0 
  ? projectId 
  : 'fallback-project-id'

export const config = defaultWagmiConfig({
  chains,
  projectId: effectiveProjectId,
  metadata,
  // Removed custom transports - let Web3Modal handle RPC connections automatically
})