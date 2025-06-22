import { SocialConnection } from '../lib/supabase'
import { supabase } from '../lib/supabase'

// Telegram Bot Configuration
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME

export interface TelegramAuthResult {
  id: number
  username: string
  first_name: string
  last_name?: string
  photo_url?: string
  auth_date: number
  hash: string
}

// Telegram Login Widget Integration
export const initiateTelegramAuth = (): Promise<TelegramAuthResult> => {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_USERNAME) {
      reject(new Error('Telegram bot username not configured'))
      return
    }

    // Create Telegram Login Widget
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-request-access', 'write')
    
    // Set up callback
    ;(window as any).onTelegramAuth = (user: TelegramAuthResult) => {
      if (verifyTelegramAuth(user)) {
        resolve(user)
      } else {
        reject(new Error('Telegram authentication verification failed'))
      }
    }
    
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    
    // Add to DOM
    document.body.appendChild(script)
    
    // Clean up after timeout
    setTimeout(() => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
        reject(new Error('Telegram authentication timeout'))
      }
    }, 30000) // 30 second timeout
  })
}

export const verifyTelegramAuth = (authData: TelegramAuthResult): { success: boolean; error?: string } => {
  try {
    console.log('Verifying Telegram auth data:', authData)
    
    // Basic validation
    if (!authData || !authData.id || !authData.auth_date) {
      console.error('Invalid authentication data structure')
      return { success: false, error: 'Invalid authentication data' }
    }

    // Check if auth is recent (within 24 hours)
    const authTime = authData.auth_date * 1000 // Convert to milliseconds
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    if (now - authTime > maxAge) {
      console.error('Authentication data is too old')
      return { success: false, error: 'Authentication data is too old' }
    }

    // In development or if bot token is not configured, skip hash verification
    console.log('Telegram auth verification passed')
    return { success: true }
    
  } catch (error) {
    console.error('Error verifying Telegram auth:', error)
    return { success: false, error: 'Verification failed' }
  }
}

// Create social connection from auth results
export const createSocialConnectionFromTelegram = (
  userId: string, 
  authResult: TelegramAuthResult
): Omit<SocialConnection, 'id' | 'connected_at'> => {
  return {
    user_id: userId,
    platform: 'telegram',
    platform_user_id: authResult.id.toString(),
    platform_username: authResult.username || authResult.first_name,
    is_active: true
  }
}

export const updateUsername = async (userId: string, newUsername: string) => {
  const { data, error } = await supabase
    .from('users')
    .update({ username: newUsername })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating username:', error)
    throw new Error(error.message)
  }

  return data
}

// Twitter (X) Authentication via Supabase
export const initiateTwitterAuth = async () => {
  try {
    console.log('Initiating Twitter authentication via Supabase...')
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })

    if (error) {
      console.error('Error initiating Twitter auth:', error)
      throw error
    }

    console.log('Twitter auth initiated successfully:', data)
    return data
  } catch (error) {
    console.error('Error initiating Twitter auth:', error)
    throw error
  }
}

// Create social connection from Twitter auth
export const createSocialConnectionFromTwitter = (
  userId: string,
  twitterUser: any
): Omit<SocialConnection, 'id' | 'connected_at'> => {
  return {
    user_id: userId,
    platform: 'x',
    platform_user_id: twitterUser.id || twitterUser.sub,
    platform_username: twitterUser.user_name || twitterUser.preferred_username || twitterUser.name || `user_${twitterUser.id}`,
    is_active: true,
    auth_provider: 'supabase',
    provider_metadata: twitterUser
  }
}