import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { mainnet, arbitrum, polygon } from 'wagmi/chains'

// Get projectId from environment variables
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

if (!projectId || projectId === 'your_project_id_here' || projectId.trim() === '') {
  throw new Error(
    'WalletConnect Project ID is required. Please:\n' +
    '1. Visit https://cloud.walletconnect.com\n' +
    '2. Create a project and get your Project ID\n' +
    '3. Add VITE_WALLETCONNECT_PROJECT_ID=your_actual_project_id to your .env file'
  )
}

// Create wagmiConfig
const metadata = {
  name: 'pumped.fun',
  description: 'Beyond The Pump',
  url: 'https://web3modal.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const chains = [mainnet, arbitrum, polygon] as const

export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
})