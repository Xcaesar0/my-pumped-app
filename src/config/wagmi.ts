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

// Only create config if we have a valid project ID
const hasValidProjectId = projectId && projectId !== 'your_project_id_here' && projectId.length > 0

export const config = hasValidProjectId ? defaultWagmiConfig({
  chains,
  projectId: projectId,
  metadata,
}) : defaultWagmiConfig({
  chains,
  projectId: '', // Empty string to prevent RPC calls
  metadata,
  enableWalletConnect: false, // Disable WalletConnect entirely if no valid project ID
})