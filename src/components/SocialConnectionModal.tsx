import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { User, SocialConnection } from '../lib/supabase'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { verifyTelegramAuth } from '../services/socialAuth'
import TelegramIcon from './icons/TelegramIcon'

interface SocialConnectionModalProps {
  user: User
  platform: 'telegram'
  onClose: () => void
}

interface TelegramUser {
  id: number
  username: string
  first_name: string
  last_name?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

const SocialConnectionModal: React.FC<SocialConnectionModalProps> = ({ user, platform, onClose }) => {
  const { 
    addConnection, 
    removeConnection, 
    getConnectionByPlatform,
    loading: connectionsLoading,
  } = useSocialConnections(user.id)
  
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const connection = getConnectionByPlatform(platform)

  const platformConfig = {
    telegram: {
      name: 'Telegram',
      icon: <TelegramIcon className="w-6 h-6 text-blue-400" />,
      description: 'Connect your Telegram account to verify tasks and earn rewards.',
      instructions: 'Click the button below to open the Telegram authentication window.',
    },
  }

  const config = platformConfig[platform]

  useEffect(() => {
    if (authStatus !== 'idle') return

    // Clean up any existing script first
    const existingScript = document.querySelector('script[src*="telegram-widget"]')
    if (existingScript) {
      existingScript.remove()
    }

    // Inject the Telegram login script
    const script = document.createElement('script')
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Pumpeddotfun_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    
    // Find the placeholder and append the script
    const placeholder = document.getElementById('telegram-login-placeholder')
    if (placeholder) {
      placeholder.appendChild(script)
      scriptRef.current = script
    }

    return () => {
      // Cleanup the script and the global callback
      if (scriptRef.current) {
        scriptRef.current.remove()
      }
      delete window.onTelegramAuth
    }
  }, [authStatus])

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setAuthStatus('loading')
    setError(null)
    
    try {
      console.log('Telegram auth data received:', telegramUser)
      
      // Verify the authentication data
      const verification = verifyTelegramAuth(telegramUser)
      
      if (!verification.success) {
        throw new Error(verification.error || 'Telegram authentication verification failed')
      }

      // Create the social connection
      await addConnection({
        platform: 'telegram',
        platform_user_id: telegramUser.id.toString(),
        platform_username: telegramUser.username || telegramUser.first_name,
        user_id: user.id,
        is_active: true
      })
      
      setAuthStatus('success')
      setTimeout(onClose, 2000)
    } catch (err) {
      console.error('Telegram auth error:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
      setAuthStatus('error')
    }
  }

  // Set up global callback
  useEffect(() => {
    window.onTelegramAuth = handleTelegramAuth
    return () => {
      window.onTelegramAuth = undefined
    }
  }, [user.id])
  
  const handleDisconnect = async () => {
    if (connection) {
      await removeConnection(connection.id)
      onClose()
    }
  }

  const handleRetry = () => {
    setAuthStatus('idle')
    setError(null)
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
            {config.icon}
            <h2 className="text-xl font-bold text-white">Connect {config.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-400 text-center">{config.description}</p>
          
          {connection ? (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-white">
                    Connected as @{connection.platform_username}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={connectionsLoading}
                className="w-full px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"
              >
                {connectionsLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {authStatus === 'idle' && (
                <div id="telegram-login-placeholder" className="flex justify-center"></div>
              )}

              {authStatus === 'loading' && (
                <div className="text-center text-gray-400">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p>Verifying authentication...</p>
                </div>
              )}

              {authStatus === 'success' && (
                <div className="p-4 rounded-lg bg-green-500/10 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400">Successfully connected!</p>
                </div>
              )}

              {authStatus === 'error' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-500 text-center">
                {config.instructions}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            🔒 Your data is encrypted and secure. We only access the information you authorize.
          </p>
        </div>
      </div>
    </>
  )
}

export default SocialConnectionModal