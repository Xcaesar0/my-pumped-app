import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { User, SocialConnection, supabase } from '../lib/supabase'
import { useUser } from '../hooks/useUser'
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
    connections,
    loading: connectionsLoading,
    refreshUser
  } = useUser()
  
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const connection = connections.find(c => c.platform === platform)

  const platformConfig = {
    telegram: {
      name: 'Telegram',
      icon: <TelegramIcon className="w-6 h-6 text-blue-400" />,
      description: 'Connect your Telegram account to verify tasks and earn rewards.',
      instructions: 'Click the button below to open the Telegram authentication window.',
    },
  }

  const config = platformConfig[platform]

  const loadTelegramWidget = () => {
    // Clean up any existing script first
    const existingScript = document.querySelector('script[src*="telegram-widget"]')
    if (existingScript) {
      existingScript.remove()
    }

    // Clean up existing global callback
    delete window.onTelegramAuth

    // Inject the Telegram login script
    const script = document.createElement('script')
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Pumpeddotfun_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    
    // Add error handling for script loading
    script.onerror = () => {
      console.error('Failed to load Telegram widget script')
      setError('Failed to load Telegram authentication widget. Please try again.')
      setAuthStatus('error')
    }
    
    // Find the placeholder and append the script
    const placeholder = document.getElementById('telegram-login-placeholder')
    if (placeholder) {
      // Clear placeholder first
      placeholder.innerHTML = ''
      placeholder.appendChild(script)
      scriptRef.current = script
    } else {
      console.error('Telegram login placeholder not found')
      setError('Authentication widget container not found. Please refresh and try again.')
      setAuthStatus('error')
    }
  }

  useEffect(() => {
    if (authStatus === 'idle') {
      loadTelegramWidget()
    }

    return () => {
      // Cleanup the script and the global callback
      if (scriptRef.current) {
        scriptRef.current.remove()
      }
      delete window.onTelegramAuth
    }
  }, [authStatus, retryCount])

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    console.log('Telegram auth callback triggered:', telegramUser)
    setAuthStatus('loading')
    setError(null)
    
    try {
      // Verify the authentication data
      const verification = verifyTelegramAuth(telegramUser)
      
      if (!verification.success) {
        throw new Error(verification.error || 'Telegram authentication verification failed')
      }

      console.log('Creating social connection for user:', user.id)

      // Create the social connection with proper error handling
      const connectionData = {
        platform: 'telegram' as const,
        platform_user_id: telegramUser.id.toString(),
        platform_username: telegramUser.username || telegramUser.first_name || `user_${telegramUser.id}`,
        user_id: user.id,
        is_active: true
      }

      console.log('Connection data:', connectionData)

      const newConnection = await supabase.from('social_connections').insert(connectionData).select().single();
      if (newConnection.error) throw newConnection.error;

      console.log('Connection created successfully:', newConnection.data)
      await refreshUser();
      
      setAuthStatus('success')
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose()
      }, 2000)
      
    } catch (err) {
      console.error('Telegram auth error:', err)
      
      // Provide more specific error messages
      let errorMessage = 'An unknown error occurred.'
      
      if (err instanceof Error) {
        if (err.message.includes('duplicate key')) {
          errorMessage = 'This Telegram account is already connected to another user.'
        } else if (err.message.includes('foreign key')) {
          errorMessage = 'User account not found. Please refresh and try again.'
        } else if (err.message.includes('verification')) {
          errorMessage = 'Telegram authentication verification failed. Please try again.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
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
      try {
        await supabase.from('social_connections').delete().eq('id', connection.id)
        await refreshUser();
        onClose()
      } catch (err) {
        console.error('Error disconnecting:', err)
        setError('Failed to disconnect. Please try again.')
      }
    }
  }

  const handleRetry = () => {
    setAuthStatus('idle')
    setError(null)
    setRetryCount(prev => prev + 1)
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
                className="w-full px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {connectionsLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {authStatus === 'idle' && (
                <div>
                  <div id="telegram-login-placeholder" className="flex justify-center min-h-[50px] items-center">
                    <div className="text-gray-400 text-sm">Loading Telegram widget...</div>
                  </div>
                </div>
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
                  <p className="text-sm text-gray-400 mt-1">Closing in a moment...</p>
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

              {authStatus === 'idle' && (
                <p className="text-xs text-gray-500 text-center">
                  {config.instructions}
                </p>
              )}
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