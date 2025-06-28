import React, { useState, useEffect } from 'react'
import { 
  Target, 
  Trophy, 
  Star, 
  Users, 
  Copy, 
  Check, 
  Crown, 
  Medal, 
  Award, 
  Hash,
  MessageCircle,
  ExternalLink,
  TrendingUp,
  Calendar,
  Clock,
  Zap,
  HelpCircle,
  ShieldCheck,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Gift,
  CheckCircle,
  ArrowRight,
  User as UserIcon,
  Settings,
  MoreVertical,
  AlertCircle
} from 'lucide-react'
import { User } from '../lib/supabase'
import {
  useBountyData,
  LeaderboardEntry,
  BountyTasksData,
  UserStats,
  BountyTask
} from '../hooks/useBountyData'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useReferralStatus } from '../hooks/useReferralStatus'
import { useTaskPersistence } from '../hooks/useTaskPersistence'
import SocialConnectionModal from './SocialConnectionModal'
import SocialConnectionRequiredModal from './SocialConnectionRequiredModal'
import UserProfile from './UserProfile'
import ReferralCodeInput from './ReferralCodeInput'
import TelegramIcon from './icons/TelegramIcon'
import XIcon from './icons/XIcon'
import ProfileSettingsModal from './ProfileSettingsModal'
import { useAccount } from 'wagmi'

interface BountyHunterDashboardProps {
  user: User
}

const BountyHunterDashboard: React.FC<BountyHunterDashboardProps> = ({ user }) => {
  const { address, isConnected } = useAccount();
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState<'telegram' | 'x' | null>(null)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [taskCompletionMessage, setTaskCompletionMessage] = useState<string | null>(null)

  const {
    leaderboard,
    bountyTasks,
    userStats,
    loading,
    refreshData,
    beginTask,
    verifyTask,
    isAuthenticated
  } = useBountyData(address ? address.toLowerCase() : null)

  const { getConnectionByPlatform, loading: connectionsLoading } = useSocialConnections(user.id)
  const { referralStatus, loading: referralLoading, refreshReferralStatus } = useReferralStatus(user.id)
  const { 
    updateTaskStatus, 
    markTaskCompleted, 
    isTaskCompleted, 
    getTaskStatus,
    syncWithDatabase
  } = useTaskPersistence(user.id)

  // Use the referral code from the user object - ensure it's properly displayed
  const referralCode = user.referral_code || 'LOADING...'

  useEffect(() => {
    refreshReferralStatus()
    syncWithDatabase()
  }, [])

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      setCopiedReferral(true)
      setTimeout(() => setCopiedReferral(false), 2000)
    } catch (err) {
      console.error('Failed to copy referral code:', err)
    }
  }

  const handleTaskAction = async (taskId: string, platform?: 'telegram' | 'x' | 'general') => {
    const task = bountyTasks.active.find(t => t.id === taskId)
    if (!task) return
    
    // Get current task status from persistence hook
    const currentStatus = getTaskStatus(taskId)
    
    // Check if user has the required connection for this task
    if (task?.requires_connection && platform === 'telegram') {
      const connection = getConnectionByPlatform(platform)
      
      // If no connection exists, show the connection required modal
      if (!connection || !connection.is_active) {
        setShowConnectionModal(platform)
        return
      }
    }

    // Check if user has the required connection for X tasks
    if (task?.requires_connection && platform === 'x') {
      const connection = getConnectionByPlatform(platform)
      
      // If no connection exists, show the connection required modal
      if (!connection || !connection.is_active) {
        setShowConnectionModal(platform)
        return
      }
    }

    // If task is not started, begin it
    if (currentStatus === 'not_started') {
      // Update local status
      await updateTaskStatus(taskId, 'in_progress')
      
      // Call the API to begin task
      await beginTask(taskId)
    } else if (currentStatus === 'in_progress') {
      // Get X username from social connections for task verification
      const xConnection = getConnectionByPlatform('x')
      const xUsername = xConnection?.platform_username || 'unknown'
      
      // Mark task as verifying in local storage
      await updateTaskStatus(taskId, 'verifying')
      
      // Call the API to verify task
      const result = await markTaskCompleted(taskId, task.title, xUsername)
      
      if (result.success) {
        // Update local status to completed
        await updateTaskStatus(taskId, 'completed')
        
        // Show completion message
        setTaskCompletionMessage(`Task completed! You earned ${result.points || task.points} points.`)
        setTimeout(() => setTaskCompletionMessage(null), 4000)
        
        // Refresh data to show updated points
        refreshData()
      } else {
        // Revert to in_progress if verification failed
        await updateTaskStatus(taskId, 'in_progress')
        
        // Show error message
        setTaskCompletionMessage(result.message || 'Failed to verify task. Please try again.')
        setTimeout(() => setTaskCompletionMessage(null), 4000)
      }
    }
  }

  const handleConnectSocial = (platform: 'telegram' | 'x') => {
    setShowConnectionModal(null)
    setShowProfileModal(true)
  }

  const handleReferralSuccess = () => {
    // Refresh both user stats and referral status
    refreshData()
    refreshReferralStatus()
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
        return <Hash className="w-4 h-4 text-gray-400" />
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

  const getTaskIcon = (task: BountyTask) => {
    switch (task.platform) {
      case 'telegram':
        return <TelegramIcon className="w-4 h-4 text-blue-400" />
      case 'x':
        return <XIcon className="w-4 h-4 text-white" />
      default:
        return <HelpCircle className="w-4 h-4 text-gray-400" />
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Please log in to view tasks and leaderboard.</h2>
          <p className="text-gray-400">You must be authenticated to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen px-3 sm:px-4 md:px-6 py-6 sm:py-8" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}>
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">Bounty Hunter</h1>
            </div>
            <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto px-4">
              Complete social media tasks, invite friends, and climb the leaderboard to earn exclusive rewards
            </p>
          </div>

          {/* Task Completion Message */}
          {taskCompletionMessage && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-3">
              <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg max-w-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm font-medium">{taskCompletionMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            {/* Left Column: Global Leaderboard */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <div className="rounded-2xl border border-gray-700/50 overflow-hidden h-full" style={{ backgroundColor: '#171717' }}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                    <h2 className="text-lg sm:text-xl font-bold text-white">Global Leaderboard</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400">Top users ranked by points</p>
                </div>

                {/* Leaderboard Content */}
                <div className="p-4 sm:p-6 flex-1">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: '#52D593', borderTopColor: 'transparent' }}></div>
                      <p className="text-gray-400 text-sm">Loading leaderboard...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard?.slice(0, 10).map((entry, index) => (
                        <div
                          key={`${entry.username}-${entry.rank}`}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            entry.username === user.username
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-gray-700/50 bg-gray-800/20 hover:border-gray-600/50'
                          }`}
                          style={{ 
                            borderColor: entry.username === user.username ? '#52D593' : undefined,
                            backgroundColor: entry.username === user.username ? 'rgba(82, 213, 147, 0.05)' : undefined
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Rank */}
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border ${getRankColor(entry.rank)}`}>
                              {entry.rank <= 3 ? (
                                getRankIcon(entry.rank)
                              ) : (
                                <span className="text-xs sm:text-sm font-medium">{entry.rank}</span>
                              )}
                            </div>
                            {/* User info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1">
                                <p className="text-sm font-medium text-white truncate">{entry.username}</p>
                                <span className="text-xs text-gray-400 flex items-center space-x-1">
                                  <span>(</span>
                                  <Users className="w-3 h-3" />
                                  <span>{entry.referrals || 0}</span>
                                  <span>)</span>
                                </span>
                              </div>
                            </div>
                            {/* Points */}
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">{entry.points.toLocaleString()}</p>
                              <p className="text-xs text-gray-400">Points</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column: Your Stats & Referral */}
            <div className="lg:col-span-3 order-1 lg:order-2 space-y-4 sm:space-y-6">
              {/* Merged Stats and Referral Section */}
              <div className="rounded-2xl border border-gray-700/50 p-4 sm:p-6" style={{ backgroundColor: '#171717' }}>
                {/* Refer & Earn */}
                <div className="text-center mb-6 sm:mb-8">
                  <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                    <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Refer and Earn</h2>
                  </div>
                  <p className="text-gray-400 max-w-lg mx-auto text-sm sm:text-base">
                    Share your referral code with friends. Earn up to 100 points per successful referral chain!
                  </p>
                </div>

                {/* Enhanced Stats with Point Breakdown */}
                <div className="space-y-4 mb-6 sm:mb-8">
                  {/* Global Rank */}
                  <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                    <div className="flex items-center space-x-2 mb-1">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400 font-medium">Global Rank</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-white">#{userStats?.globalRank || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{userStats?.totalPoints || 0} Points</p>
                  </div>

                  {/* Point Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <Users className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                        <span className="text-xs text-blue-400 font-medium">Friends Invited</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-white">{userStats?.totalReferrals || 0}</p>
                      <p className="text-xs text-gray-400">Total Referrals</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Valid Referrals</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-white">{userStats?.bonusReferrals || 0}</p>
                      <p className="text-xs text-gray-400">Socials Linked</p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">All Activities</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-white">{userStats?.pointsFromChain || 0}</p>
                      <p className="text-xs text-gray-400">All Activities</p>
                    </div>
                  </div>
                </div>

                {/* Your Referral Code Section */}
                <div className="p-3 sm:p-4 rounded-lg mb-4 sm:mb-6" style={{ backgroundColor: '#262626' }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-400">Your Referral Code</h3>
                      <p className="text-base sm:text-lg font-mono text-white mt-1 truncate">{referralCode}</p>
                    </div>
                    <button
                      onClick={handleCopyReferral}
                      className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors duration-200 ml-3"
                    >
                      {copiedReferral ? (
                        <>
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Enter Referral Code Section */}
                {!referralStatus?.hasUsedReferral && (
                  <ReferralCodeInput 
                    userId={user.id} 
                    onSuccess={handleReferralSuccess}
                  />
                )}

                {/* Referral Progress */}
                {referralStatus?.hasUsedReferral && (
                  <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">Referral Active</span>
                    </div>
                    <p className="text-sm text-white mb-1">
                      Referred by: <span className="font-semibold">{referralStatus.referrerUsername}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      You've earned {referralStatus.pointsEarned} points from the referral system
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tasks */}
            <div className="lg:col-span-2 order-3 lg:order-3">
              <div className="rounded-2xl border border-gray-700/50 h-full" style={{ backgroundColor: '#171717' }}>
                <div className="p-4 sm:p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    <h2 className="text-lg sm:text-xl font-bold text-white">Active Tasks</h2>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: '#52D593', borderTopColor: 'transparent' }}></div>
                      <p className="text-gray-400 text-sm">Loading tasks...</p>
                    </div>
                  ) : bountyTasks.active.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {bountyTasks.active.map((task) => {
                        // Get task status from persistence hook
                        const persistedStatus = getTaskStatus(task.id)
                        const effectiveStatus = persistedStatus !== 'not_started' ? persistedStatus : task.status
                        
                        return (
                          <div
                            key={task.id}
                            className="p-3 sm:p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                                {getTaskIcon(task)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-white mb-1">{task.title}</h3>
                                <p className="text-xs text-gray-400 mb-3">{task.description}</p>
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 sm:space-x-4">
                                    <span className="text-xs text-gray-400">
                                      {task.points} points
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {task.platform === 'telegram' && 'Telegram'}
                                      {task.platform === 'x' && 'X (Twitter)'}
                                    </span>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleTaskAction(task.id, task.platform)}
                                    className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 ${
                                      effectiveStatus === 'not_started'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : effectiveStatus === 'verifying'
                                        ? 'bg-gray-600 text-white cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                    disabled={effectiveStatus === 'verifying'}
                                  >
                                    {effectiveStatus === 'not_started' ? 'Start' : 
                                     effectiveStatus === 'verifying' ? 'Verifying...' : 'Verify'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-2">No Active Tasks</h3>
                      <p className="text-gray-400 text-sm">
                        Complete more activities to unlock new tasks.
                      </p>
                    </div>
                  )}

                  {/* Completed Tasks Section */}
                  {bountyTasks.completed.length > 0 && (
                    <div className="mt-6 sm:mt-8">
                      <h3 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                        <span>Completed Tasks</span>
                      </h3>
                      <div className="space-y-3">
                        {bountyTasks.completed.map((task) => (
                          <div
                            key={task.id}
                            className="p-3 rounded-lg border border-green-500/30 bg-green-500/5"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-white truncate">{task.title}</h4>
                                <p className="text-xs text-green-400">+{task.points} points earned</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showProfileModal && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showConnectionModal && (
        <SocialConnectionRequiredModal
          platform={showConnectionModal}
          onClose={() => setShowConnectionModal(null)}
          onConnect={() => handleConnectSocial(showConnectionModal)}
        />
      )}
    </>
  )
}

export default BountyHunterDashboard