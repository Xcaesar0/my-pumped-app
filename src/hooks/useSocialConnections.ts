import { useState, useEffect, useCallback } from 'react'
import { SocialConnection, getSocialConnections, createSocialConnection, deleteSocialConnection, supabase } from '../lib/supabase'

export const useSocialConnections = (userId: string | null) => {
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [twitterIdentity, setTwitterIdentity] = useState<any>(null)

  // Load Twitter connection from auth table
  const loadTwitterConnection = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      
      if (session?.user) {
        const identities = session.user.identities || []
        const twitterId = identities.find((id: any) => id.provider === 'twitter')
        setTwitterIdentity(twitterId)
        
        // If Twitter identity exists, update localStorage
        if (twitterId) {
          localStorage.setItem('x_connected', 'true')
          localStorage.setItem('x_connected_at', new Date().toISOString())
          localStorage.setItem('x_username', twitterId.identity_data?.username || 'x_user')
        }
      } else {
        // Check localStorage for X connection status
        const xConnected = localStorage.getItem('x_connected') === 'true'
        if (xConnected) {
          // Create a mock Twitter identity for UI purposes
          setTwitterIdentity({
            id: 'local-storage-id',
            identity_data: {
              username: localStorage.getItem('x_username') || 'x_user'
            }
          })
        } else {
          setTwitterIdentity(null)
        }
      }
    } catch (err) {
      console.error('Error loading Twitter connection:', err)
      
      // Fallback to localStorage if auth fails
      const xConnected = localStorage.getItem('x_connected') === 'true'
      if (xConnected) {
        setTwitterIdentity({
          id: 'local-storage-id',
          identity_data: {
            username: localStorage.getItem('x_username') || 'x_user'
          }
        })
      } else {
        setTwitterIdentity(null)
      }
    }
  }, [])

  const loadConnections = useCallback(async () => {
    if (!userId || userId === 'undefined') {
      setConnections([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Load all connections from social_connections table
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error
      
      // Filter out X connections as they're handled by auth
      const nonXConnections = data?.filter(conn => conn.platform !== 'x') || []
      setConnections(nonXConnections)

      // Check if there's an X connection in the database
      const xConnection = data?.find(conn => conn.platform === 'x')
      if (xConnection) {
        // Update localStorage with X connection data
        localStorage.setItem('x_connected', 'true')
        localStorage.setItem('x_connected_at', xConnection.connected_at)
        localStorage.setItem('x_username', xConnection.platform_username)
      }

      // Load Twitter connection from auth
      await loadTwitterConnection()
    } catch (err) {
      console.error('Error loading connections:', err)
      setError('Failed to load social connections')
    } finally {
      setLoading(false)
    }
  }, [userId, loadTwitterConnection])

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      loadConnections()
    } else {
      setConnections([])
      setTwitterIdentity(null)
      setLoading(false)
    }
  }, [userId, loadConnections])

  // Subscribe to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadTwitterConnection()
      } else {
        // Check localStorage before clearing Twitter identity
        const xConnected = localStorage.getItem('x_connected') === 'true'
        if (!xConnected) {
          setTwitterIdentity(null)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadTwitterConnection])

  const getConnectionByPlatform = useCallback((platform: string) => {
    if (platform === 'x') {
      // Check localStorage first
      const xConnected = localStorage.getItem('x_connected') === 'true'
      
      if (xConnected || twitterIdentity) {
        return {
          platform: 'x',
          platform_user_id: twitterIdentity?.id || 'local-storage-id',
          platform_username: twitterIdentity?.identity_data?.username || localStorage.getItem('x_username') || 'x_user',
          is_active: true
        }
      }
      return null
    }
    
    // For Telegram, check localStorage first
    if (platform === 'telegram') {
      const telegramConnected = localStorage.getItem('telegram_connected') === 'true'
      if (telegramConnected) {
        return {
          platform: 'telegram',
          platform_user_id: localStorage.getItem('telegram_user_id') || 'local-storage-id',
          platform_username: localStorage.getItem('telegram_username') || 'telegram_user',
          is_active: true
        }
      }
    }
    
    return connections.find(conn => conn.platform === platform)
  }, [connections, twitterIdentity])

  const removeConnection = async (connectionId: string, platform: string) => {
    if (!userId && platform !== 'x') return

    setLoading(true)
    setError(null)

    try {
      if (platform === 'x') {
        // For Twitter, sign out from auth to remove the connection
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setTwitterIdentity(null)
        
        // Clear localStorage
        localStorage.removeItem('x_connected')
        localStorage.removeItem('x_connected_at')
        localStorage.removeItem('x_username')
        
        // If user ID is available, also update the database
        if (userId) {
          try {
            // Update user's x_connected_at to null
            await supabase
              .from('users')
              .update({ x_connected_at: null })
              .eq('id', userId)
              
            // Delete any X connections in social_connections table
            await supabase
              .from('social_connections')
              .delete()
              .eq('user_id', userId)
              .eq('platform', 'x')
          } catch (dbError) {
            console.warn('Error updating database after X disconnection:', dbError)
          }
        }
      } else if (platform === 'telegram') {
        // For Telegram, use existing deletion
        await deleteSocialConnection(connectionId)
        
        // Clear localStorage
        localStorage.removeItem('telegram_connected')
        localStorage.removeItem('telegram_user_id')
        localStorage.removeItem('telegram_username')
        
        await loadConnections()
      } else {
        // For other platforms, use existing deletion
        await deleteSocialConnection(connectionId)
        await loadConnections()
      }
    } catch (err) {
      console.error('Error removing connection:', err)
      setError('Failed to remove connection')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const addConnection = async (connection: Omit<SocialConnection, 'id' | 'connected_at'>) => {
    setLoading(true)
    setError(null)
    
    try {
      if (connection.platform === 'x') {
        console.log('Adding X connection to database:', connection)
        
        // Create X connection in database
        const { data, error } = await supabase
          .from('social_connections')
          .upsert({
            user_id: connection.user_id,
            platform: 'x',
            platform_user_id: connection.platform_user_id,
            platform_username: connection.platform_username,
            is_active: true,
            connected_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,platform'
          })
          .select()
          .single()
          
        if (error) {
          console.error('Error creating X connection in database:', error)
          throw error
        }
        
        console.log('X connection created in database:', data)
        
        // Store X connection in localStorage for persistence
        localStorage.setItem('x_connected', 'true')
        localStorage.setItem('x_connected_at', new Date().toISOString())
        localStorage.setItem('x_username', connection.platform_username)
        
        // Refresh Twitter identity
        await loadTwitterConnection()
        
        // Process social connection points
        try {
          const { data: pointsData, error: pointsError } = await supabase.rpc('process_social_connection_points', {
            user_id_param: connection.user_id,
            platform_param: 'x'
          })
          
          if (pointsError) {
            console.warn('Error processing social connection points:', pointsError)
          } else {
            console.log('Social connection points processed:', pointsData)
          }
        } catch (pointsError) {
          console.warn('Error calling process_social_connection_points:', pointsError)
        }
        
        return data
      }
      
      if (connection.platform === 'telegram') {
        // Store Telegram connection in localStorage for persistence
        localStorage.setItem('telegram_connected', 'true')
        localStorage.setItem('telegram_user_id', connection.platform_user_id)
        localStorage.setItem('telegram_username', connection.platform_username)
        
        // Create connection in database
        const upsertedConnection = await createSocialConnection(connection)
        
        // Process social connection points
        try {
          const { data: pointsData, error: pointsError } = await supabase.rpc('process_social_connection_points', {
            user_id_param: connection.user_id,
            platform_param: 'telegram'
          })
          
          if (pointsError) {
            console.warn('Error processing social connection points:', pointsError)
          } else {
            console.log('Social connection points processed:', pointsData)
          }
        } catch (pointsError) {
          console.warn('Error calling process_social_connection_points:', pointsError)
        }
        
        setConnections(prev => {
          const existingIndex = prev.findIndex(
            conn => conn.user_id === connection.user_id && conn.platform === connection.platform
          )
          
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = upsertedConnection
            return updated
          } else {
            return [...prev, upsertedConnection]
          }
        })

        return upsertedConnection
      }
      
      // For other platforms
      const upsertedConnection = await createSocialConnection(connection)
      setConnections(prev => {
        const existingIndex = prev.findIndex(
          conn => conn.user_id === connection.user_id && conn.platform === connection.platform
        )
        
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = upsertedConnection
          return updated
        } else {
          return [...prev, upsertedConnection]
        }
      })

      return upsertedConnection
    } catch (err) {
      console.error('Error adding social connection:', err)
      setError('Failed to add social connection')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const isConnected = (platform: 'telegram' | 'x') => {
    if (platform === 'x') {
      return !!twitterIdentity || localStorage.getItem('x_connected') === 'true'
    }
    if (platform === 'telegram') {
      return !!getConnectionByPlatform(platform) || localStorage.getItem('telegram_connected') === 'true'
    }
    return !!getConnectionByPlatform(platform)
  }

  return {
    connections,
    loading,
    error,
    getConnectionByPlatform,
    removeConnection,
    loadConnections,
    addConnection,
    isConnected,
    twitterIdentity
  }
}