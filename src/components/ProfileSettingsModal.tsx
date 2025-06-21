import React, { useState } from 'react'
import { X, Settings, LogOut, Unlink } from 'lucide-react'
import { User } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useDisconnect } from 'wagmi'
import SocialConnectionModal from './SocialConnectionModal'
import TelegramIcon from './icons/TelegramIcon'
import { initiateXAuth } from '../services/socialAuth'

interface ProfileSettingsModalProps {
  user: User
  onClose: () => void
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ user, onClose }) => {
  const { 
    getConnectionByPlatform, 
    removeConnection,
    loading: connectionsLoading 
  } = useSocialConnections(user.id)
  
  const { disconnect } = useDisconnect()
  
  const [socialModal, setSocialModal] = useState<'telegram' | null>(null)

  const telegramConnection = getConnectionByPlatform('telegram')
  const xConnection = getConnectionByPlatform('x')

  const handleDisconnectWallet = () => {
    disconnect()
    onClose()
  }

  const handleDisconnectSocial = async (platform: 'telegram' | 'x') => {
    const connection = getConnectionByPlatform(platform)
    if (connection) {
      await removeConnection(connection.id)
    }
  }

  const handleConnectX = async () => {
    try {
      await initiateXAuth()
    } catch (error) {
      console.error("Failed to initiate X auth:", error)
    }
  }
  
  const XIcon = () => (
    <svg 
      width="24" 
      height="24"
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5 text-white"
    >
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.407l-6.378-7.63-7.634 7.63H.887l8.44-9.74L0 1.154h7.594l5.96 7.14L18.901 1.153zm-1.8 20.32h2.89l-16.88-19.82H1.54l16.88 19.82z" fill="currentColor"/>
    </svg>
  )

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      ></div>

      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#141414] rounded-2xl border border-gray-700/50 shadow-lg z-50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-gray-400" />
            <h2 className="text-xl font-bold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Account</h3>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#262626' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-xs text-gray-400 truncate">{user.wallet_address}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Social Connections</h3>
            <div className="space-y-3">
              <div
                className="w-full flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: '#262626' }}
              >
                <div className="flex items-center space-x-3">
                  <TelegramIcon className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-white">Telegram</span>
                </div>
                {connectionsLoading ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : telegramConnection ? (
                  <button
                    onClick={() => handleDisconnectSocial('telegram')}
                    className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSocialModal('telegram')}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                  >
                    Connect
                  </button>
                )}
              </div>
              <div
                className="w-full flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: '#262626' }}
              >
                <div className="flex items-center space-x-3">
                  <XIcon />
                  <span className="text-sm font-medium text-white">X (Twitter)</span>
                </div>
                {connectionsLoading ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : xConnection ? (
                  <button
                    onClick={() => handleDisconnectSocial('x')}
                    className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleConnectX}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleDisconnectWallet}
            className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Disconnect Wallet</span>
          </button>
        </div>
      </div>

      {socialModal === 'telegram' && (
        <SocialConnectionModal
          user={user}
          platform="telegram"
          onClose={() => setSocialModal(null)}
        />
      )}
    </>
  )
}

export default ProfileSettingsModal