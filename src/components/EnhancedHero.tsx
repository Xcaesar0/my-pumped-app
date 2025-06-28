import React, { useState, useEffect } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { useUser } from '../hooks/useUser'
import { useReferralInfo } from '../hooks/useReferralInfo'
import { ChevronDown, Zap, Users, Trophy, ArrowRight, Sparkles, Shield, Coins } from 'lucide-react'
import ConnectedHero from './ConnectedHero'
import ReferralCodeModal from './ReferralCodeModal'
import Particles from './Particles'

const EnhancedHero = () => {
  const [activeCard, setActiveCard] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const { open } = useWeb3Modal()
  const { isConnected } = useAccount()
  const { 
    user, 
    loading, 
    isNewUser,
    showReferralModal, 
    handleReferralModalClose, 
    handleReferralSuccess 
  } = useUser()
  const { referralCode, referrerUsername, isLoadingReferrer } = useReferralInfo()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleConnectWallet = () => {
    open()
  }

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Show loading only when actually loading and no user exists yet
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="absolute inset-0">
          <Particles 
            particleCount={150}
            particleColors={['#52D593', '#4ade80', '#22c55e']}
            speed={0.5}
            alphaParticles={true}
          />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded animate-pulse w-48 mx-auto"></div>
            <div className="h-4 bg-gray-700 rounded animate-pulse w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  // Show connected hero when user exists
  if (isConnected && user) {
    return (
      <>
        <ConnectedHero user={user} />
        
        {showReferralModal && isNewUser && (
          <ReferralCodeModal
            onClose={handleReferralModalClose}
            onSuccess={handleReferralSuccess}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Animated Background */}
      <div className="absolute inset-0">
        <Particles 
          particleCount={200}
          particleColors={['#52D593', '#4ade80', '#22c55e', '#16a34a']}
          speed={0.3}
          alphaParticles={true}
          particleBaseSize={80}
        />
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-blue-900/20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

      {/* Referral Notification */}
      {referralCode && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl shadow-2xl max-w-sm text-center border border-blue-500/30">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-bold">Special Invite!</span>
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </div>
            <p className="text-sm font-medium">
              {isLoadingReferrer
                ? 'Checking invite...'
                : referrerUsername
                  ? `${referrerUsername} invited you! Connect to claim rewards.`
                  : 'You have an exclusive invite! Connect to join.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-6xl mx-auto transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          
          {/* Hero Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 backdrop-blur-sm mb-8">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Exclusive Beta Access</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>

          {/* Main Headline */}
          <div className="space-y-6 mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Beyond The
              <span className="block bg-gradient-to-r from-green-400 via-green-300 to-blue-400 bg-clip-text text-transparent">
                Pump
              </span>
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Join the next evolution of crypto communities. 
              <span className="text-green-400 font-semibold"> Earn rewards</span>, 
              <span className="text-blue-400 font-semibold"> climb leaderboards</span>, and 
              <span className="text-purple-400 font-semibold"> unlock exclusive perks</span>.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            {[
              {
                id: 'rewards',
                icon: Coins,
                title: 'Earn Rewards',
                description: 'Complete social tasks and referrals to earn points and exclusive rewards',
                color: 'from-yellow-500 to-orange-500'
              },
              {
                id: 'community',
                icon: Users,
                title: 'Build Community',
                description: 'Invite friends and grow your network while earning bonus multipliers',
                color: 'from-blue-500 to-purple-500'
              },
              {
                id: 'compete',
                icon: Trophy,
                title: 'Compete & Win',
                description: 'Climb the global leaderboard for cash prizes and NFT rewards',
                color: 'from-green-500 to-teal-500'
              }
            ].map((feature, index) => (
              <div
                key={feature.id}
                className={`group relative p-6 rounded-2xl border border-gray-700/50 bg-gray-900/40 backdrop-blur-sm hover:border-gray-600/50 transition-all duration-500 cursor-pointer ${
                  activeCard === feature.id ? 'scale-105 border-green-500/50' : ''
                }`}
                style={{
                  animationDelay: `${index * 200}ms`
                }}
                onMouseEnter={() => setActiveCard(feature.id)}
                onMouseLeave={() => setActiveCard(null)}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-green-400 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {feature.description}
                </p>
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="space-y-8">
            <button
              onClick={handleConnectWallet}
              className="group relative inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/25"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-400 to-green-300 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
              <span>Connect Wallet & Start Earning</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>

            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Connect your wallet to unlock exclusive rewards, complete tasks, and join thousands of users earning together.
            </p>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <button
              onClick={scrollToFeatures}
              className="group flex flex-col items-center space-y-2 text-gray-400 hover:text-green-400 transition-colors duration-300"
            >
              <span className="text-xs font-medium opacity-75 group-hover:opacity-100">Explore Features</span>
              <ChevronDown className="w-5 h-5 animate-bounce group-hover:text-green-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose <span className="text-green-400">Pumped.Fun</span>?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Experience the most rewarding crypto community platform with real benefits and exciting challenges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Real Cash Rewards",
                description: "Top referrers earn up to $1,500 + exclusive NFTs",
                icon: "💰",
                highlight: true
              },
              {
                title: "Social Tasks",
                description: "Complete Twitter and Telegram challenges for instant points",
                icon: "📱"
              },
              {
                title: "Ranking System",
                description: "Climb from Degen to General with exclusive name tags",
                icon: "🏆"
              },
              {
                title: "Referral Multipliers",
                description: "Earn bonus points for every friend who joins your network",
                icon: "🔄"
              },
              {
                title: "Global Leaderboard",
                description: "Compete with users worldwide for top positions",
                icon: "🌍"
              },
              {
                title: "Instant Rewards",
                description: "Get points immediately upon completing tasks",
                icon: "⚡"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border transition-all duration-500 hover:scale-105 ${
                  feature.highlight 
                    ? 'border-green-500/50 bg-gradient-to-br from-green-900/20 to-green-800/10' 
                    : 'border-gray-700/50 bg-gray-900/40'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className={`text-lg font-bold mb-2 ${
                  feature.highlight ? 'text-green-400' : 'text-white'
                }`}>
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="space-y-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to <span className="text-green-400">Level Up</span>?
            </h2>
            <p className="text-xl text-gray-400">
              Join thousands of users earning rewards and building the future of crypto communities.
            </p>
            <button
              onClick={handleConnectWallet}
              className="inline-flex items-center space-x-3 px-10 py-5 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-bold text-xl rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Modals */}
      {showReferralModal && isNewUser && (
        <ReferralCodeModal
          onClose={handleReferralModalClose}
          onSuccess={handleReferralSuccess}
        />
      )}
    </div>
  )
}

export default EnhancedHero