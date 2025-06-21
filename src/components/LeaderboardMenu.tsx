import React, { useState, useEffect } from 'react'
import { X, Trophy, Medal, Award, Crown } from 'lucide-react'
import { User, LeaderboardEntry, getLeaderboard, getUserRank } from '../lib/supabase'

interface LeaderboardMenuProps {
  user: User
  onClose: () => void
}

const LeaderboardMenu: React.FC<LeaderboardMenuProps> = ({ user, onClose }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number>(0)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const loadLeaderboard = async () => {
    try {
      const [leaderboardData, rank] = await Promise.all([
        getLeaderboard(100),
        getUserRank(user.id)
      ])
      
      setLeaderboard(leaderboardData)
      setUserRank(rank)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />
      default:
        return <Trophy className="w-4 h-4 text-gray-400" />
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
      case 2:
        return 'text-gray-300 bg-gray-300/10 border-gray-300/30'
      case 3:
        return 'text-amber-600 bg-amber-600/10 border-amber-600/30'
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700/50"
        style={{ backgroundColor: '#171717' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-gray-700/50" style={{ backgroundColor: '#171717' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Global Leaderboard</h2>
                <p className="text-sm text-gray-400">Real-time rankings by points</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-gray-700/50"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* User's Rank */}
          <div className="mt-4 p-4 rounded-lg border border-blue-500/30" style={{ backgroundColor: '#262626' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Your Rank</p>
                  <p className="font-semibold text-white">{user.username}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-400">#{userRank}</p>
                <p className="text-sm text-gray-400">{user.current_points} pts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Loading global leaderboard...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No rankings available yet</p>
                  <p className="text-sm text-gray-500 mt-2">Be the first to earn points!</p>
                </div>
              ) : (
                leaderboard.map((entry, index) => (
                  <div
                    key={`${entry.username}-${entry.rank}`}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:border-gray-600/50 ${
                      entry.username === user.username
                        ? 'border-blue-500/50 bg-blue-500/5'
                        : 'border-gray-700/50 bg-gray-800/20'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Rank */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${getRankColor(entry.rank)}`}>
                        {entry.rank <= 3 ? (
                          getRankIcon(entry.rank)
                        ) : (
                          <span className="text-sm font-bold">#{entry.rank}</span>
                        )}
                      </div>

                      {/* Username */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${
                          entry.username === user.username ? 'text-blue-400' : 'text-white'
                        }`}>
                          {entry.username}
                          {entry.username === user.username && (
                            <span className="ml-2 text-xs text-blue-400">(You)</span>
                          )}
                        </p>
                        {entry.rank <= 3 && (
                          <p className="text-xs text-gray-400">
                            {entry.rank === 1 ? '👑 Champion' : 
                             entry.rank === 2 ? '🥈 Runner-up' : 
                             '🥉 Third Place'}
                          </p>
                        )}
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <p className="font-bold text-white">{entry.points.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Refresh Button */}
          <div className="mt-6 text-center">
            <button
              onClick={loadLeaderboard}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span className="text-sm text-white">Refreshing...</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-white">Refresh Rankings</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeaderboardMenu