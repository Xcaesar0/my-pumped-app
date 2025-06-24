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
      } else {
        setTwitterIdentity(null)
      }
    } catch (err) {
      console.error('Error loading Twitter connection:', err)
      setTwitterIdentity(null)
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
      // Only load non-Twitter connections from social_connections table
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .neq('platform', 'x')

      if (error) throw error
      setConnections(data || [])

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
        setTwitterIdentity(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadTwitterConnection])

  const getConnectionByPlatform = useCallback((platform: string) => {
    if (platform === 'x') {
      return twitterIdentity ? {
        platform: 'x',
        platform_user_id: twitterIdentity.id,
        platform_username: twitterIdentity.identity_data?.username || '',
        is_active: true
      } : null
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
    if (connection.platform === 'x') {
      throw new Error('Twitter connections are now handled through Supabase Auth')
    }

    setLoading(true)
    try {
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
      throw err
    } finally {
      setLoading(false)
    }
  }

  const isConnected = (platform: 'telegram' | 'x') => {
    if (platform === 'x') {
      return !!twitterIdentity
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