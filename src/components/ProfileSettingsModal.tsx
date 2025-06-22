import React, { useState } from 'react'
import { X, Settings, LogOut, Unlink, AlertCircle } from 'lucide-react'
import { User } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useDisconnect } from 'wagmi'
import SocialConnectionModal from './SocialConnectionModal'
import TelegramIcon from './icons/TelegramIcon'
import XIcon from './icons/XIcon'
import { initiateXAuth, createMockXConnection } from '../services/socialAuth'

interface ProfileSettingsModalProps {
  user: User
  onClose: () => void
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ user, onClose }) => {
  const { 
    getConnectionByPlatform, 
    removeConnection,
    addConnection,
    loading: connectionsLoading 
  } = useSocialConnections(user.id)
  
  const { disconnect } = useDisconnect()
  
  const [socialModal, setSocialModal] = useState<'telegram' | null>(null)
  const [xAuthLoading, setXAuthLoading] = useState(false)
  const [xAuthMessage, setXAuthMessage] = useState<string | null>(null)

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
    setXAuthLoading(true)
    setXAuthMessage(null)
    
    try {
      // For now, show development message and create a mock connection
      setXAuthMessage('X (Twitter) integration is under development. Creating demo connection...')
      
      // Wait a moment to show the message
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Create a mock X connection for demo purposes
      await createMockXConnection(user.id, `${user.username}_x`)
      
      setXAuthMessage('Demo X connection created! Full integration coming soon.')
      
      // Clear message after a few seconds
      setTimeout(() => {
        setXAuthMessage(null)
      }, 3000)
      
    } catch (error) {
      console.error('Failed to connect X account:', error)
      setXAuthMessage(error instanceof Error ? error.message : 'Failed to connect X account')
      
      // Clear error message after a few seconds
      setTimeout(() => {
        setXAuthMessage(null)
      }, 5000)
    } finally {
      setXAuthLoading(false)
    }
  }

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
                  <XIcon className="w-5 h-5 text-white" />
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
                    disabled={xAuthLoading}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    {xAuthLoading ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
              
              {/* X Auth Status Message */}
              {xAuthMessage && (
                <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-300">{xAuthMessage}</p>
                  </div>
                </div>
              )}
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