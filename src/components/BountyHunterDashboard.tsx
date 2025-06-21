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
  LeaderboardData,
  BountyTasksData,
  UserStats,
  BountyTask
} from '../hooks/useBountyData'
import { useSocialConnections } from '../hooks/useSocialConnections'
import { useReferralStatus } from '../hooks/useReferralStatus'
import SocialConnectionModal from './SocialConnectionModal'
import SocialConnectionRequiredModal from './SocialConnectionRequiredModal'
import UserProfile from './UserProfile'
import ReferralCodeInput from './ReferralCodeInput'
import TelegramIcon from './icons/TelegramIcon'
import XIcon from './icons/XIcon'
import ProfileSettingsModal from './ProfileSettingsModal'

interface BountyHunterDashboardProps {
  user: User
}

const BountyHunterDashboard: React.FC<BountyHunterDashboardProps> = ({ user }) => {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'referrers' | 'points'>('referrers')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState<'telegram' | null>(null)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [showXDevMessage, setShowXDevMessage] = useState(false)

  const {
    leaderboard,
    bountyTasks,
    userStats,
    loading,
    refreshData,
    beginTask,
    verifyTask
  } = useBountyData(user.id)

  const { getConnectionByPlatform } = useSocialConnections(user.id)
  const { referralStatus, loading: referralLoading, refreshReferralStatus } = useReferralStatus(user.id)

  // Use the referral code from the user object - ensure it's properly displayed
  const referralCode = user.referral_code || 'LOADING...'

  useEffect(() => {
    refreshReferralStatus()
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
    
    // Only check for connection if it's a Telegram task that requires connection
    if (task?.requires_connection && platform === 'telegram') {
      const connection = getConnectionByPlatform(platform)
      
      if (!connection) {
        // Show connection required modal
        setShowConnectionModal(platform)
        return
      }
    }

    // For X tasks, show development message
    if (platform === 'x') {
      setShowXDevMessage(true)
      setTimeout(() => setShowXDevMessage(false), 3000)
    }

    // If task is not started, begin it
    if (task?.status === 'not_started') {
      await beginTask(taskId)
    } else if (task?.status === 'in_progress') {
      await verifyTask(taskId)
    }
  }

  const handleConnectSocial = (platform: 'telegram') => {
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

  return (
    <>
      <div className="min-h-screen px-4 sm:px-6 py-8" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}>
                <Target className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white">Bounty Hunter</h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Complete social media tasks, invite friends, and climb the leaderboard to earn exclusive rewards
            </p>
          </div>

          {/* Development Message for X Tasks */}
          {showXDevMessage && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
              <div className="bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">
                    X (Twitter) integration is under development. Task opened in new tab!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 lg:gap-8 mb-8">
            {/* Left Column: Global Leaderboard */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <div className="rounded-2xl border border-gray-700/50 overflow-hidden h-full" style={{ backgroundColor: '#171717' }}>
                {/* Header */}
                <div className="p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-xl font-bold text-white">Global Leaderboard</h2>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex space-x-1 p-1 rounded-lg" style={{ backgroundColor: '#262626' }}>
                    <button
                      onClick={() => setActiveLeaderboardTab('referrers')}
                      className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        activeLeaderboardTab === 'referrers'
                          ? 'text-white' 
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      style={{ backgroundColor: activeLeaderboardTab === 'referrers' ? '#52D593' : 'transparent' }}
                    >
                      <Users className="w-4 h-4" />
                      <span>Referrers</span>
                    </button>
                    <button
                      onClick={() => setActiveLeaderboardTab('points')}
                      className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        activeLeaderboardTab === 'points'
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      style={{ backgroundColor: activeLeaderboardTab === 'points' ? '#52D593' : 'transparent' }}
                    >
                      <Star className="w-4 h-4" />
                      <span>Points</span>
                    </button>
                  </div>
                </div>

                {/* Leaderboard Content */}
                <div className="p-6 flex-1">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: '#52D593', borderTopColor: 'transparent' }}></div>
                      <p className="text-gray-400 text-sm">Loading leaderboard...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard[activeLeaderboardTab]?.slice(0, 10).map((entry, index) => (
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
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getRankColor(entry.rank)}`}>
                              {entry.rank <= 3 ? (
                                getRankIcon(entry.rank)
                              ) : (
                                <span className="text-sm font-medium">{entry.rank}</span>
                              )}
                            </div>
                            {/* User info */}
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white truncate">{entry.username}</p>
                            </div>
                            {/* Points/Referrals */}
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">
                                {activeLeaderboardTab === 'points' ? (entry as any).points : (entry as any).referrals}
                              </p>
                              <p className="text-xs text-gray-400">
                                {activeLeaderboardTab === 'points' ? 'Points' : 'Referrals'}
                              </p>
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
            <div className="lg:col-span-3 order-1 lg:order-2 space-y-6">
              {/* Merged Stats and Referral Section */}
              <div className="rounded-2xl border border-gray-700/50 p-6" style={{ backgroundColor: '#171717' }}>
                {/* Refer & Earn */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <Gift className="w-8 h-8 text-green-400" />
                    <h2 className="text-3xl font-bold text-white">Refer and Earn</h2>
                  </div>
                  <p className="text-gray-400 max-w-lg mx-auto">
                    Share your referral code with friends to earn points and climb the leaderboard together.
                  </p>
                </div>

                {/* Stats */}
                <div className="space-y-4 mb-8">
                  {/* Global Rank */}
                  <div className="p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                    <div className="flex items-center space-x-2 mb-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-yellow-400 font-medium">Global Rank</span>
                    </div>
                    <p className="text-2xl font-bold text-white">#{userStats?.globalRank || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{userStats?.totalPoints || 0} Points</p>
                  </div>
                  {/* Referral and Points Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-blue-400 font-medium">Total Referrals</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{userStats?.totalReferrals || 0}</p>
                      <p className="text-xs text-gray-400">+{userStats?.bonusPoints || 0} bonus points</p>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Total Points</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{userStats?.totalPoints || 0}</p>
                      <p className="text-xs text-gray-400">From all activities</p>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Active Referrals</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{userStats?.bonusReferrals || 0}</p>
                      <p className="text-xs text-gray-400">Earning points for you</p>
                    </div>
                  </div>
                </div>

                {/* Your Referral Code Section */}
                <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: '#262626' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Your Referral Code</h3>
                      <p className="text-lg font-mono text-white mt-1">{referralCode}</p>
                    </div>
                    <button
                      onClick={handleCopyReferral}
                      className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors duration-200"
                    >
                      {copiedReferral ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium text-white">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="text-sm font-medium text-white">Copy</span>
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
              </div>
            </div>

            {/* Right Column: Tasks */}
            <div className="lg:col-span-2 order-3 lg:order-3">
              <div className="rounded-2xl border border-gray-700/50 h-full" style={{ backgroundColor: '#171717' }}>
                <div className="p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-green-400" />
                    <h2 className="text-xl font-bold text-white">Active Tasks</h2>
                  </div>
                </div>

                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: '#52D593', borderTopColor: 'transparent' }}></div>
                      <p className="text-gray-400 text-sm">Loading tasks...</p>
                    </div>
                  ) : bountyTasks.active.length > 0 ? (
                    <div className="space-y-4">
                      {bountyTasks.active.map((task) => (
                        <div
                          key={task.id}
                          className="p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: '#262626' }}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                              {getTaskIcon(task)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-white mb-1">{task.title}</h3>
                              <p className="text-xs text-gray-400 mb-3">{task.description}</p>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
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
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 ${
                                    task.status === 'not_started'
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {task.status === 'not_started' ? 'Start' : 'Verify'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">No Active Tasks</h3>
                      <p className="text-gray-400 text-sm">
                        Complete more activities to unlock new tasks.
                      </p>
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