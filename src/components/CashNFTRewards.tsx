import React from 'react'
import { DollarSign, Award, Gift, Crown, Medal, Trophy } from 'lucide-react'

const CashNFTRewards: React.FC = () => {
  const topTwentyRewards = [
    { rank: 1, nfts: 3, cash: 1500 },
    { rank: 2, nfts: 3, cash: 1200 },
    { rank: 3, nfts: 3, cash: 1000 },
    { rank: 4, nfts: 3, cash: 800 },
    { rank: 5, nfts: 3, cash: 700 },
    { rank: 6, nfts: 3, cash: 600 },
    { rank: 7, nfts: 3, cash: 500 },
    { rank: 8, nfts: 3, cash: 450 },
    { rank: 9, nfts: 3, cash: 400 },
    { rank: 10, nfts: 3, cash: 350 },
    { rank: 11, nfts: 3, cash: 300 },
    { rank: 12, nfts: 3, cash: 275 },
    { rank: 13, nfts: 3, cash: 250 },
    { rank: 14, nfts: 3, cash: 225 },
    { rank: 15, nfts: 3, cash: 200 },
    { rank: 16, nfts: 3, cash: 175 },
    { rank: 17, nfts: 3, cash: 150 },
    { rank: 18, nfts: 3, cash: 125 },
    { rank: 19, nfts: 3, cash: 100 },
    { rank: 20, nfts: 3, cash: 100 }
  ]

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
      case 2:
        return <Medal className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300" />
      case 3:
        return <Award className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
      default:
        return <Trophy className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#52D593' }} />
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
        return 'text-green-400 bg-green-400/10 border-green-400/30'
    }
  }

  return (
    <div className="rounded-2xl border border-gray-700/50 overflow-hidden h-full flex flex-col" style={{ backgroundColor: '#171717' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}>
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Cash & NFT Rewards</h2>
            <p className="text-xs sm:text-sm text-gray-400">$10,000 + 200 NFTs for top referrers</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-green-500/30" style={{ backgroundColor: '#262626', borderColor: '#52D593' }}>
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#52D593' }} />
              <span className="text-xs text-gray-400">Total Cash</span>
            </div>
            <p className="text-sm sm:text-lg font-bold" style={{ color: '#52D593' }}>$10,000</p>
          </div>
          <div className="p-3 rounded-lg border border-purple-500/30" style={{ backgroundColor: '#262626' }}>
            <div className="flex items-center space-x-2 mb-1">
              <Gift className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Total NFTs</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-purple-400">200</p>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Top 20 Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🥇 Top 20 – Cash + NFTs</h3>
          </div>
          
          <div className="space-y-2">
            {topTwentyRewards.map((reward) => (
              <div
                key={reward.rank}
                className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:border-gray-600/50 ${getRankColor(reward.rank)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border ${getRankColor(reward.rank)}`}>
                      {getRankIcon(reward.rank)}
                    </div>
                    <div>
                      <p className="font-medium text-white text-xs sm:text-sm">
                        {reward.rank === 1 ? '1st' : reward.rank === 2 ? '2nd' : reward.rank === 3 ? '3rd' : `${reward.rank}th`} Place
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-xs sm:text-sm font-bold text-purple-400">{reward.nfts} NFTs</span>
                      <span className="text-xs text-gray-400">+</span>
                      <span className="text-xs sm:text-sm font-bold" style={{ color: '#52D593' }}>${reward.cash.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/50 my-6"></div>

        {/* 21st-50th Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🥈 21st – 50th Place</h3>
          </div>
          
          <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50 bg-gray-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-xs sm:text-sm">Ranks 21-50</p>
                <p className="text-xs text-gray-400">30 users × 2 NFTs each</p>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-bold text-purple-400">2 NFTs</span>
                <p className="text-xs text-gray-400">60 NFTs total</p>
              </div>
            </div>
          </div>
        </div>

        {/* 51st-100th Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🥉 51st – 100th Place</h3>
          </div>
          
          <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50 bg-gray-800/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-xs sm:text-sm">Ranks 51-100</p>
                <p className="text-xs text-gray-400">50 users × 1 NFT each</p>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-bold text-purple-400">1 NFT</span>
                <p className="text-xs text-gray-400">50 NFTs total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bonus Pool Section */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🎁 Bonus Pool</h3>
          </div>
          
          <div className="p-3 sm:p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-xs sm:text-sm">Random Airdrop</p>
                <p className="text-xs text-gray-400">Top 101-200 eligible</p>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-bold text-purple-400">30 NFTs</span>
                <p className="text-xs text-gray-400">Random distribution</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CashNFTRewards