import { useState, useEffect } from 'react'
import { SocialConnection, getSocialConnections, createSocialConnection, deleteSocialConnection } from '../lib/supabase'

export const useSocialConnections = (userId: string | null) => {
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      loadConnections()
    } else {
      // Clear connections when no user
      setConnections([])
      setLoading(false)
    }
  }, [userId])

  const loadConnections = async () => {
    if (!userId || userId === 'undefined') {
      setConnections([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getSocialConnections(userId)
      setConnections(data)
    } catch (err) {
      console.error('Error loading social connections:', err)
      setError(err instanceof Error ? err.message : 'Failed to load connections')
      // Set empty connections on error to avoid showing false positive
      setConnections([])
    } finally {
      setLoading(false)
    }
  }

  const addConnection = async (connection: Omit<SocialConnection, 'id' | 'connected_at'>) => {
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
    }
  }

  const removeConnection = async (connectionId: string) => {
    try {
      await deleteSocialConnection(connectionId)
      setConnections(prev => prev.filter(conn => conn.id !== connectionId))
    } catch (err) {
      console.error('Error removing social connection:', err)
      throw err
    }
  }

  const getConnectionByPlatform = (platform: 'telegram' | 'x') => {
    return connections.find(conn => conn.platform === platform && conn.is_active)
  }

  const isConnected = (platform: 'telegram' | 'x') => {
    return !!getConnectionByPlatform(platform)
  }

  return {
    connections,
    loading,
    error,
    loadConnections,
    addConnection,
    removeConnection,
    getConnectionByPlatform,
    isConnected
  }
}