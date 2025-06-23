import { useState, useEffect, useCallback } from 'react'
import { SocialConnection, getSocialConnections, createSocialConnection, deleteSocialConnection } from '../lib/supabase'

export const useSocialConnections = (userId: string | null) => {
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConnections = useCallback(async () => {
    if (!userId || userId === 'undefined') {
      setConnections([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getSocialConnections(userId)
      setConnections(data || [])
    } catch (err) {
      console.error('Error loading connections:', err)
      setError('Failed to load social connections')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      loadConnections()
    } else {
      setConnections([])
      setLoading(false)
    }
  }, [userId, loadConnections])

  const getConnectionByPlatform = useCallback((platform: string) => {
    return connections.find(conn => conn.platform === platform)
  }, [connections])

  const removeConnection = async (connectionId: string) => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      await deleteSocialConnection(connectionId)
      // Don't set connections here - wait for loadConnections to do it
      await loadConnections() // This will update the connections state
    } catch (err) {
      console.error('Error removing connection:', err)
      setError('Failed to remove connection')
      throw err // Propagate error to component
    } finally {
      setLoading(false)
    }
  }

  const addConnection = async (connection: Omit<SocialConnection, 'id' | 'connected_at'>) => {
    setLoading(true)
    try {
      // Use the upsert-enabled createSocialConnection function
      const upsertedConnection = await createSocialConnection(connection)
      
      // Update the local state by finding and replacing the existing connection or adding the new one
      setConnections(prev => {
        const existingIndex = prev.findIndex(
          conn => conn.user_id === connection.user_id && conn.platform === connection.platform
        )
        
        if (existingIndex >= 0) {
          // Replace existing connection
          const updated = [...prev]
          updated[existingIndex] = upsertedConnection
          return updated
        } else {
          // Add new connection
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
    isConnected
  }
}