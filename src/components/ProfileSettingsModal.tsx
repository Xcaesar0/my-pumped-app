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
    loadConnections,
    error: connectionError
  } = useSocialConnections(user.id)
  
  const { disconnect } = useDisconnect()
  
  const [socialModal, setSocialModal] = useState<'telegram' | 'x' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const telegramConnection = getConnectionByPlatform('telegram')
  const xConnection = getConnectionByPlatform('x')

  useEffect(() => {
    loadConnections();
  }, [user.id, loadConnections]);

  const handleDisconnectWallet = () => {
    disconnect()
    onClose()
  }

  const handleDisconnectSocial = async (platform: 'telegram' | 'x') => {
    try {
      setError(null)
      if (platform === 'x') {
        // For Twitter, use auth signOut
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError
        await loadConnections()
      } else {
        // For other platforms, use existing connection removal
        const connection = getConnectionByPlatform(platform)
        if (connection && 'id' in connection) {
          await removeConnection(connection.id, platform)
        }
      }
    } catch (err) {
      console.error(`Error disconnecting ${platform}:`, err)
      setError(`Failed to disconnect ${platform}. Please try again.`)
    }
  }

  const handleConnectX = async () => {
    try {
      setError(null)
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: `${window.location.origin}/callback`
        }
      })
      if (authError) {
        console.error('Error starting Twitter OAuth:', authError)
        setError('Failed to start X connection. Please try again.')
      }
    } catch (err) {
      console.error('Error initiating X connection:', err)
      setError('Failed to start X connection. Please try again.')
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
          {(error || connectionError) && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error || connectionError}</p>
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
                {connectionsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span className="text-xs text-gray-400">Loading...</span>
                  </div>
                ) : telegramConnection ? (
                  <button
                    onClick={() => handleDisconnectSocial('telegram')}
                    className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                    disabled={connectionsLoading}
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSocialModal('telegram')}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                    disabled={connectionsLoading}
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
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span className="text-xs text-gray-400">Loading...</span>
                  </div>
                ) : xConnection ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDisconnectSocial('x')}
                      className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                      disabled={connectionsLoading}
                    >
                      <Unlink className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectX}
                    className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600"
                    disabled={connectionsLoading}
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