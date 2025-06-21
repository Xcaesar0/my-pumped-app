import React, { useState, useEffect } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { User, getUserByReferralCode } from '../lib/supabase'
import { Gift, Users, Star, Wallet, ArrowRight, CheckCircle, Crown, Hash } from 'lucide-react'

interface ReferralPageProps {
  referralCode: string
}

const ReferralPage: React.FC<ReferralPageProps> = ({ referralCode }) => {
  const [referrer, setReferrer] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { open } = useWeb3Modal()
  const { isConnected } = useAccount()

  useEffect(() => {
    loadReferrer()
  }, [referralCode])

  const loadReferrer = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Loading referrer for code:', referralCode)
      
      // Find referrer by referral code
      const referrerUser = await getUserByReferralCode(referralCode)

      if (referrerUser) {
        console.log('Found referrer:', referrerUser.username)
        setReferrer(referrerUser)
      } else {
        console.log('No referrer found for code:', referralCode)
        setError('Invalid referral code')
      }
    } catch (err) {
      console.error('Error loading referrer:', err)
      setError('Failed to load referral information')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectWallet = () => {
    // The referral code is already stored in localStorage by useReferralPersistence
    open()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading invitation...</p>
          <p className="text-gray-400 text-sm mt-2">Referral code: {referralCode}</p>
        </div>
      </div>
    )
  }

  if (error || !referrer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Hash className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Referral Code</h1>
          <p className="text-gray-400 mb-4">
            This referral code is invalid or has expired. Please check the code and try again.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Referral code: {referralCode}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ backgroundColor: '#1A1A1A' }}>
      <div className="max-w-2xl mx-auto text-center">
        {/* Header */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
            <Hash className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            You're Invited!
          </h1>
          <p className="text-xl text-gray-300">
            <span className="text-blue-400 font-semibold">{referrer.username}</span> has invited you to join pumped.fun
          </p>
        </div>

        {/* Referrer Info Card */}
        <div className="p-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 mb-8">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-400">{referrer.username}</h3>
              <p className="text-sm text-gray-400">
                {referrer.current_points.toLocaleString()} points • Rank #{referrer.current_rank || 'Unranked'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Hash className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Referral Code:</span>
            <span className="text-lg font-mono text-blue-400 tracking-wider">{referralCode}</span>
          </div>
          <p className="text-sm text-gray-300">
            Join the community and earn rewards together!
          </p>
        </div>

        {/* Invitation Card */}
        <div className="p-8 rounded-2xl border border-gray-700/50 mb-8" style={{ backgroundColor: '#171717' }}>
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-green-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Join the Community</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Connect your wallet to get started and earn exclusive rewards. Both you and {referrer.username} will receive bonus points when you complete the setup!
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-400">You Get</span>
              </div>
              <p className="text-lg font-bold text-white">25 Bonus Points</p>
              <p className="text-xs text-gray-400">Just for joining</p>
            </div>

            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center space-x-2 mb-2">
                <Gift className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Additional Rewards</span>
              </div>
              <p className="text-lg font-bold text-white">+75 Points</p>
              <p className="text-xs text-gray-400">When you connect X account</p>
            </div>
          </div>

          {/* Referrer Benefits */}
          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">{referrer.username} Gets</span>
            </div>
            <p className="text-lg font-bold text-white">10 Points</p>
            <p className="text-xs text-gray-400">When you connect your X account</p>
          </div>

          {/* Connect Button */}
          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              <Wallet className="w-5 h-5" />
              <span className="text-lg font-semibold">Connect Wallet to Join</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-lg font-medium text-green-400">Wallet Connected!</span>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                You're all set! The referral has been processed automatically.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200"
              >
                Continue to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* How it Works */}
        <div className="p-6 rounded-xl border border-gray-700/50" style={{ backgroundColor: '#262626' }}>
          <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <p className="text-gray-300">Connect your wallet</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">2</span>
              </div>
              <p className="text-gray-300">Link your X account</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">3</span>
              </div>
              <p className="text-gray-300">Earn rewards together</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By connecting your wallet, you agree to join the pumped.fun community
          </p>
        </div>
      </div>
    </div>
  )
}

export default ReferralPage