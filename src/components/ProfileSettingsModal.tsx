import React, { useState, useEffect } from 'react'
import { X, Settings, LogOut, Unlink, AlertCircle } from 'lucide-react'
import { User } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useDisconnect } from 'wagmi'
import SocialConnectionModal from './SocialConnectionModal'
import TelegramIcon from './icons/TelegramIcon'
import XIcon from './icons/XIcon'
import { supabase } from '../lib/supabase'

interface ProfileSettingsModalProps {
  user: User
  onClose: () => void
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ user, onClose }) => {
  const { 
    getConnectionByPlatform, 
    removeConnection,
    loading: connectionsLoading,
    loadConnections
  } = useSocialConnections(user.id)
  
  const { disconnect } = useDisconnect()
  
  const [socialModal, setSocialModal] = useState<'telegram' | 'x' | null>(null)
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<'telegram' | 'x' | null>(null)
  const [connectingX, setConnectingX] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const telegramConnection = getConnectionByPlatform('telegram')
  const xConnection = getConnectionByPlatform('x')

  // Reset loading states if they've been stuck for too long
  useEffect(() => {
    const resetStuckLoadingStates = () => {
      setDisconnectingPlatform(null)
      setConnectingX(false)
    }

    // Reset after 10 seconds if still loading
    const timeoutId = setTimeout(resetStuckLoadingStates, 10000)
    return () => clearTimeout(timeoutId)
  }, [disconnectingPlatform, connectingX])

  useEffect(() => {
    loadConnections();
  }, [user.id, loadConnections]);

  const handleDisconnectWallet = () => {
    disconnect()
    onClose()
  }

  const handleDisconnectSocial = async (platform: 'telegram' | 'x') => {
    if (disconnectingPlatform) return; // Prevent multiple disconnects

    const connection = getConnectionByPlatform(platform)
    if (connection) {
      try {
        setError(null)
        setDisconnectingPlatform(platform)
        await removeConnection(connection.id)
        await loadConnections() // Refresh connections after disconnect
      } catch (err) {
        console.error(`Error disconnecting ${platform}:`, err)
        setError(`Failed to disconnect ${platform}. Please try again.`)
      } finally {
        setDisconnectingPlatform(null)
      }
    }
  }

  const handleConnectX = async () => {
    if (connectingX) return; // Prevent multiple connection attempts

    try {
      setError(null)
      setConnectingX(true)
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/callback`
        }
      })
      if (authError) {
        console.error('Error starting Twitter OAuth:', authError)
        setError('Failed to start X connection. Please try again.')
        setConnectingX(false)
      }
    } catch (err) {
      console.error('Error initiating X connection:', err)
      setError('Failed to start X connection. Please try again.')
      setConnectingX(false)
    }
  }

  const LoadingSpinner = () => (
    <div className="flex items-center space-x-2">
      <svg className="animate-spin w-4 h-4 text-blue-400" viewBox="0 0 24 24">
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
          fill="none"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-xs text-gray-400">
        {disconnectingPlatform === 'telegram' ? 'Disconnecting...' :
         disconnectingPlatform === 'x' ? 'Disconnecting...' :
         connectingX ? 'Connecting...' : 'Loading...'}
      </span>
    </div>
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
            <h2 className="text-xl font-bold text-white">Profile Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

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
                {connectionsLoading || disconnectingPlatform === 'telegram' ? (
                  <LoadingSpinner />
                ) : telegramConnection ? (
                  <button
                    onClick={() => handleDisconnectSocial('telegram')}
                    className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                    disabled={!!disconnectingPlatform}
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSocialModal('telegram')}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                    disabled={!!disconnectingPlatform}
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
                {connectionsLoading || disconnectingPlatform === 'x' || connectingX ? (
                  <LoadingSpinner />
                ) : xConnection ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDisconnectSocial('x')}
                      className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                      disabled={!!disconnectingPlatform}
                    >
                      <Unlink className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                    <span className="text-xs text-gray-300">@{xConnection.platform_username}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectX}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                    disabled={connectingX || !!disconnectingPlatform}
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