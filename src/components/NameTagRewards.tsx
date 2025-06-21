import React from 'react'
import { Shield, Star, Sword, Zap, Users } from 'lucide-react'

const NameTagRewards: React.FC = () => {
  const eliteOfficers = [
    { rank: 1, title: 'General', icon: '⭐⭐⭐⭐⭐' },
    { rank: 2, title: 'Marshal', icon: '⭐⭐⭐⭐' },
    { rank: 3, title: 'Commander', icon: '⭐⭐⭐' },
    { rank: 4, title: 'Brigadier', icon: '⭐⭐' },
    { rank: 5, title: 'Colonel', icon: '⭐⭐' },
    { rank: 6, title: 'Major', icon: '⭐⭐' },
    { rank: 7, title: 'Captain', icon: '⭐' },
    { rank: 8, title: 'Lieutenant', icon: '⭐' },
    { rank: 9, title: 'Warrant', icon: '⭐' },
    { rank: 10, title: 'Sergeant', icon: '⭐' }
  ]

  const fieldForces = [
    { range: '11-20', title: 'Corporal', count: 10, icon: '🎖️' },
    { range: '21-35', title: 'Specialist', count: 15, icon: '🎖️' },
    { range: '36-50', title: 'Lancer', count: 15, icon: '🎖️' },
    { range: '51-65', title: 'Operator', count: 15, icon: '🎖️' },
    { range: '66-75', title: 'Trooper', count: 10, icon: '🎖️' },
    { range: '76-85', title: 'Rifleman', count: 10, icon: '🎖️' }
  ]

  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
    } else if (rank <= 6) {
      return <Star className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#52D593' }} />
    } else {
      return <Sword className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
    }
  }

  const getRankColor = (rank: number) => {
    if (rank <= 3) {
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
    } else if (rank <= 6) {
      return 'text-green-400 bg-green-400/10 border-green-400/30'
    } else {
      return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
    }
  }

  return (
    <div className="rounded-2xl border border-gray-700/50 overflow-hidden h-full flex flex-col" style={{ backgroundColor: '#171717' }}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #52D593 0%, #4ade80 100%)' }}>
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Name Tag Rewards</h2>
            <p className="text-xs sm:text-sm text-gray-400">Exclusive rank titles for top performers</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-yellow-500/30" style={{ backgroundColor: '#262626' }}>
            <div className="flex items-center space-x-2 mb-1">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Elite Officers</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-yellow-400">Top 10</p>
          </div>
          <div className="p-3 rounded-lg border border-green-500/30" style={{ backgroundColor: '#262626', borderColor: '#52D593' }}>
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#52D593' }} />
              <span className="text-xs text-gray-400">Total Ranks</span>
            </div>
            <p className="text-sm sm:text-lg font-bold" style={{ color: '#52D593' }}>500</p>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Elite Officers Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🏆 Ranks 1–10: Elite Officers</h3>
          </div>
          
          <div className="space-y-2">
            {eliteOfficers.map((officer) => (
              <div
                key={officer.rank}
                className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:border-gray-600/50 ${getRankColor(officer.rank)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border ${getRankColor(officer.rank)}`}>
                      {getRankIcon(officer.rank)}
                    </div>
                    <div>
                      <p className="font-medium text-white text-xs sm:text-sm">#{officer.rank}</p>
                      <p className="text-xs text-gray-400">Rank {officer.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-xs sm:text-sm">{officer.icon}</span>
                      <span className="text-xs sm:text-sm font-bold text-white">{officer.title}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/50 my-6"></div>

        {/* Field Forces Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Star className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#52D593' }} />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🎖️ Ranks 11–85: Field Forces</h3>
          </div>
          
          <div className="space-y-3">
            {fieldForces.map((force, index) => (
              <div
                key={index}
                className="p-3 sm:p-4 rounded-lg border border-gray-700/50 bg-gray-800/20 hover:border-gray-600/50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-green-500/20 flex items-center justify-center" style={{ backgroundColor: 'rgba(82, 213, 147, 0.2)' }}>
                      <span className="text-xs sm:text-sm">{force.icon}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white text-xs sm:text-sm">{force.title}</p>
                      <p className="text-xs text-gray-400">Ranks {force.range}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-bold" style={{ color: '#52D593' }}>{force.count} users</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trenchers Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Sword className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">⚔️ Ranks 86–200: Trenchers</h3>
          </div>
          
          <div className="p-3 sm:p-4 rounded-lg border border-gray-700/50 bg-gray-800/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                  <Sword className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-xs sm:text-sm">Trencher</p>
                  <p className="text-xs text-gray-400">Ranks 86-200</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-bold text-gray-400">115 users</span>
              </div>
            </div>
          </div>
        </div>

        {/* Degens Section */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <h3 className="text-sm sm:text-lg font-semibold text-white">🤪 Ranks 201–500: Degens</h3>
          </div>
          
          <div className="p-3 sm:p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-xs sm:text-sm">Degen</p>
                  <p className="text-xs text-gray-400">Ranks 201-500</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs sm:text-sm font-bold text-purple-400">300 users</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NameTagRewards