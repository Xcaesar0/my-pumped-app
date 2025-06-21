import React, { useState, useEffect, useRef } from 'react'
import { X, Edit2, Check, User as UserIcon } from 'lucide-react'
import { User } from '../lib/supabase'
import { updateUsername } from '../services/socialAuth'

interface UserProfileProps {
  user: User
  onClose: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onClose }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState(user.username)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleUpdateUsername = async () => {
    if (newUsername.trim() === '' || newUsername.trim() === user.username) {
      setIsEditing(false)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUsername(user.id, newUsername.trim())
      setSuccess('Username updated successfully!')
      setIsEditing(false)
    } catch (err) {
      setError('Failed to update username. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUpdateUsername()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setNewUsername(user.username)
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
            <UserIcon className="w-6 h-6 text-gray-400" />
            <h2 className="text-xl font-bold text-white">Your Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200 hover:bg-gray-700/50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onBlur={handleUpdateUsername}
                    onKeyDown={handleKeyDown}
                    className="bg-gray-700 text-white text-lg font-semibold rounded-md px-2 py-1"
                    disabled={loading}
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-white">{newUsername}</h3>
                )}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 rounded-full hover:bg-gray-700"
                >
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-400 break-all">{user.wallet_address}</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}
        </div>
      </div>
    </>
  )
}

export default UserProfile